import type { App } from 'obsidian';
import type { ParsedId } from './types';

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getExistingIds(app: App, folderPath: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const normalized = folderPath === '/' ? '' : folderPath;
    const files = app.vault.getMarkdownFiles().filter(f => {
        const p = f.parent?.path ?? '';
        return (p === '/' ? '' : p) === normalized;
    });
    for (const file of files) {
        const cache = app.metadataCache.getFileCache(file);
        const id = cache?.frontmatter?.['zettel-id'];
        if (typeof id === 'string' && id) ids.add(id);
    }
    return ids;
}

async function getAllIds(app: App): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file);
        const id = cache?.frontmatter?.['zettel-id'];
        if (typeof id === 'string' && id) ids.add(id);
    }
    return ids;
}

export abstract class IdScheme {
    constructor(protected app: App) {}
    abstract nextRootId(folderPath: string): Promise<string>;
    abstract nextChildId(parentId: string, folderPath: string): Promise<string>;
    abstract parseId(id: string): ParsedId;
    abstract isHierarchical(): boolean;
    abstract assignMigrationIds(nodes: MigrationNode[], parentNewId: string | null): void;
}

export interface MigrationNode {
    zettelId: string;
    parentId: string | null;
    newId: string;
    children: MigrationNode[];
}

// ---------------------------------------------------------------------------
// Luhmann Alphanumeric
// ---------------------------------------------------------------------------

function parseLuhmannSegments(id: string): string[] {
    return id.match(/(\d+|[a-z])/g) ?? [];
}

export class LuhmannScheme extends IdScheme {
    async nextRootId(folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const used: number[] = [];
        for (const id of ids) {
            if (/^\d+$/.test(id)) used.push(parseInt(id, 10));
        }
        const max = used.length > 0 ? Math.max(...used) : 0;
        return (max + 1).toString();
    }

    async nextChildId(parentId: string, folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const segments = parseLuhmannSegments(parentId);
        const lastSeg = segments[segments.length - 1] ?? '';
        const endsWithLetter = /[a-z]/.test(lastSeg);

        if (endsWithLetter) {
            // Add a number suffix
            const pattern = new RegExp(`^${escapeRegex(parentId)}(\\d+)$`);
            const used: number[] = [];
            for (const id of ids) {
                const m = id.match(pattern);
                if (m) used.push(parseInt(m[1], 10));
            }
            const max = used.length > 0 ? Math.max(...used) : 0;
            return parentId + (max + 1).toString();
        } else {
            // Add a letter suffix
            const pattern = new RegExp(`^${escapeRegex(parentId)}([a-z])$`);
            const used: number[] = [];
            for (const id of ids) {
                const m = id.match(pattern);
                if (m) used.push(m[1].charCodeAt(0));
            }
            const maxCode = used.length > 0 ? Math.max(...used) : 'a'.charCodeAt(0) - 1;
            return parentId + String.fromCharCode(maxCode + 1);
        }
    }

    parseId(id: string): ParsedId {
        const segments = parseLuhmannSegments(id);
        if (segments.length <= 1) return { parentId: null, depth: 0 };
        return { parentId: segments.slice(0, -1).join(''), depth: segments.length - 1 };
    }

    isHierarchical(): boolean { return true; }

    assignMigrationIds(nodes: MigrationNode[], parentNewId: string | null): void {
        const roots = nodes.filter(n => n.parentId === parentNewId);
        roots.sort((a, b) => a.zettelId.localeCompare(b.zettelId));
        roots.forEach((node, i) => {
            if (parentNewId === null) {
                node.newId = (i + 1).toString();
            } else {
                const endsWithLetter = /[a-z]$/.test(parentNewId);
                if (endsWithLetter) {
                    node.newId = parentNewId + (i + 1).toString();
                } else {
                    node.newId = parentNewId + String.fromCharCode('a'.charCodeAt(0) + i);
                }
            }
            this.assignMigrationIds(nodes, node.zettelId);
        });
    }
}

// ---------------------------------------------------------------------------
// Decimal
// ---------------------------------------------------------------------------

export class DecimalScheme extends IdScheme {
    async nextRootId(folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const used: number[] = [];
        for (const id of ids) {
            if (/^\d+$/.test(id)) used.push(parseInt(id, 10));
        }
        const max = used.length > 0 ? Math.max(...used) : 0;
        return (max + 1).toString();
    }

    async nextChildId(parentId: string, folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const pattern = new RegExp(`^${escapeRegex(parentId)}\\.(\\d+)$`);
        const used: number[] = [];
        for (const id of ids) {
            const m = id.match(pattern);
            if (m) used.push(parseInt(m[1], 10));
        }
        const max = used.length > 0 ? Math.max(...used) : 0;
        return `${parentId}.${max + 1}`;
    }

    parseId(id: string): ParsedId {
        const parts = id.split('.');
        if (parts.length <= 1) return { parentId: null, depth: 0 };
        return { parentId: parts.slice(0, -1).join('.'), depth: parts.length - 1 };
    }

    isHierarchical(): boolean { return true; }

    assignMigrationIds(nodes: MigrationNode[], parentNewId: string | null): void {
        const roots = nodes.filter(n => n.parentId === parentNewId);
        roots.sort((a, b) => a.zettelId.localeCompare(b.zettelId));
        roots.forEach((node, i) => {
            node.newId = parentNewId === null
                ? (i + 1).toString()
                : `${parentNewId}.${i + 1}`;
            this.assignMigrationIds(nodes, node.zettelId);
        });
    }
}

// ---------------------------------------------------------------------------
// Timestamp (YYYYMMDDHHMM)
// ---------------------------------------------------------------------------

function currentTimestamp(): string {
    const now = new Date();
    return [
        now.getFullYear().toString().padStart(4, '0'),
        (now.getMonth() + 1).toString().padStart(2, '0'),
        now.getDate().toString().padStart(2, '0'),
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
    ].join('');
}

export class TimestampScheme extends IdScheme {
    async nextRootId(_folderPath: string): Promise<string> {
        return currentTimestamp();
    }

    async nextChildId(parentId: string, folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const pattern = new RegExp(`^${escapeRegex(parentId)}_(\\d+)$`);
        const used: number[] = [];
        for (const id of ids) {
            const m = id.match(pattern);
            if (m) used.push(parseInt(m[1], 10));
        }
        const max = used.length > 0 ? Math.max(...used) : 0;
        return `${parentId}_${max + 1}`;
    }

    parseId(id: string): ParsedId {
        const idx = id.indexOf('_');
        if (idx === -1) return { parentId: null, depth: 0 };
        return { parentId: id.slice(0, idx), depth: 1 };
    }

    isHierarchical(): boolean { return false; }

    assignMigrationIds(_nodes: MigrationNode[], _parentNewId: string | null): void {
        // Timestamp scheme cannot migrate — no stable position-based IDs
    }
}

// ---------------------------------------------------------------------------
// Sequential (001, 002, ...)
// ---------------------------------------------------------------------------

export class SequentialScheme extends IdScheme {
    async nextRootId(_folderPath: string): Promise<string> {
        const ids = await getAllIds(this.app);
        const used: number[] = [];
        for (const id of ids) {
            const n = parseInt(id, 10);
            if (!isNaN(n) && /^\d+$/.test(id)) used.push(n);
        }
        const max = used.length > 0 ? Math.max(...used) : 0;
        return (max + 1).toString().padStart(3, '0');
    }

    async nextChildId(_parentId: string, folderPath: string): Promise<string> {
        return this.nextRootId(folderPath);
    }

    parseId(_id: string): ParsedId {
        return { parentId: null, depth: 0 };
    }

    isHierarchical(): boolean { return false; }

    assignMigrationIds(_nodes: MigrationNode[], _parentNewId: string | null): void {}
}

// ---------------------------------------------------------------------------
// Custom template
// ---------------------------------------------------------------------------

interface TemplateRegex {
    pattern: string;
    nGroup: number | null;
    letterGroup: number | null;
}

function templateToRegex(tpl: string): TemplateRegex {
    let nGroup: number | null = null;
    let letterGroup: number | null = null;
    let groupIndex = 1;

    const parts = tpl.split(/(\{\w+\})/);
    const patternParts = parts.map(part => {
        if (/^\{\w+\}$/.test(part)) {
            const key = part.slice(1, -1);
            switch (key) {
                case 'n': nGroup = groupIndex++; return '(\\d+)';
                case 'letter': letterGroup = groupIndex++; return '([a-z])';
                case 'parent': return '.+';
                case 'YYYY': return '\\d{4}';
                case 'MM': return '\\d{2}';
                case 'DD': return '\\d{2}';
                case 'HH': return '\\d{2}';
                case 'mm': return '\\d{2}';
                default: return escapeRegex(part);
            }
        }
        return escapeRegex(part);
    });
    return { pattern: patternParts.join(''), nGroup, letterGroup };
}

function applyTemplate(tpl: string, ctx: Record<string, string>): string {
    return tpl.replace(/\{(\w+)\}/g, (_, key) => ctx[key] ?? '');
}

export class CustomScheme extends IdScheme {
    constructor(app: App, private rootTpl: string, private childTpl: string) {
        super(app);
    }

    private nowCtx(): Record<string, string> {
        const now = new Date();
        return {
            YYYY: now.getFullYear().toString().padStart(4, '0'),
            MM: (now.getMonth() + 1).toString().padStart(2, '0'),
            DD: now.getDate().toString().padStart(2, '0'),
            HH: now.getHours().toString().padStart(2, '0'),
            mm: now.getMinutes().toString().padStart(2, '0'),
        };
    }

    async nextRootId(folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const { pattern, nGroup, letterGroup } = templateToRegex(this.rootTpl);
        const rx = new RegExp(`^${pattern}$`);
        const usedN: number[] = [];
        const usedL: number[] = [];
        for (const id of ids) {
            const m = id.match(rx);
            if (!m) continue;
            if (nGroup !== null && m[nGroup]) usedN.push(parseInt(m[nGroup], 10));
            if (letterGroup !== null && m[letterGroup]) usedL.push(m[letterGroup].charCodeAt(0));
        }
        const ctx: Record<string, string> = {
            ...this.nowCtx(),
            n: (usedN.length > 0 ? Math.max(...usedN) + 1 : 1).toString(),
            letter: String.fromCharCode(usedL.length > 0 ? Math.max(...usedL) + 1 : 'a'.charCodeAt(0)),
            parent: '',
        };
        return applyTemplate(this.rootTpl, ctx);
    }

    async nextChildId(parentId: string, folderPath: string): Promise<string> {
        const ids = await getExistingIds(this.app, folderPath);
        const tplWithParent = this.childTpl.replace('{parent}', escapeRegex(parentId));
        const { pattern, nGroup, letterGroup } = templateToRegex(tplWithParent);
        const rx = new RegExp(`^${pattern}$`);
        const usedN: number[] = [];
        const usedL: number[] = [];
        for (const id of ids) {
            const m = id.match(rx);
            if (!m) continue;
            if (nGroup !== null && m[nGroup]) usedN.push(parseInt(m[nGroup], 10));
            if (letterGroup !== null && m[letterGroup]) usedL.push(m[letterGroup].charCodeAt(0));
        }
        const ctx: Record<string, string> = {
            ...this.nowCtx(),
            n: (usedN.length > 0 ? Math.max(...usedN) + 1 : 1).toString(),
            letter: String.fromCharCode(usedL.length > 0 ? Math.max(...usedL) + 1 : 'a'.charCodeAt(0)),
            parent: parentId,
        };
        return applyTemplate(this.childTpl, ctx);
    }

    parseId(_id: string): ParsedId {
        return { parentId: null, depth: 0 };
    }

    isHierarchical(): boolean { return true; }

    assignMigrationIds(_nodes: MigrationNode[], _parentNewId: string | null): void {}
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScheme(app: App, settings: import('./types').PluginSettings): IdScheme {
    switch (settings.scheme) {
        case 'luhmann':    return new LuhmannScheme(app);
        case 'decimal':    return new DecimalScheme(app);
        case 'timestamp':  return new TimestampScheme(app);
        case 'sequential': return new SequentialScheme(app);
        case 'custom':     return new CustomScheme(app, settings.customRootTemplate, settings.customChildTemplate);
    }
}
