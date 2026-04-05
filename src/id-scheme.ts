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

function parseLuhmannSegments(id: string): string[] {
    return id.match(/(\d+|[a-z])/g) ?? [];
}

/**
 * Luhmann alphanumeric folgezettel (1, 1a, 1a1, 1b, …).
 */
export class LuhmannScheme {
    constructor(private app: App) {}

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
            const pattern = new RegExp(`^${escapeRegex(parentId)}(\\d+)$`);
            const used: number[] = [];
            for (const id of ids) {
                const m = id.match(pattern);
                if (m) used.push(parseInt(m[1], 10));
            }
            const max = used.length > 0 ? Math.max(...used) : 0;
            return parentId + (max + 1).toString();
        } else {
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
}
