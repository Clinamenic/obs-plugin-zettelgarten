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

/** Split into alternating runs of digits and lowercase letters (e.g. `1a10` -> ['1','a','10'], `1aa` -> ['1','aa']). */
function parseLuhmannSegments(id: string): string[] {
    return id.match(/(\d+|[a-z]+)/g) ?? [];
}

/**
 * Spreadsheet-style column index: a=1, z=26, aa=27, az=52, ba=53, ...
 */
function lettersToIndex(s: string): number {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i) - 'a'.charCodeAt(0) + 1;
        if (c < 1 || c > 26) return NaN;
        n = n * 26 + c;
    }
    return n;
}

function indexToLetters(index: number): string {
    if (index < 1) return 'a';
    let n = index;
    let s = '';
    while (n > 0) {
        n--;
        s = String.fromCharCode('a'.charCodeAt(0) + (n % 26)) + s;
        n = Math.floor(n / 26);
    }
    return s;
}

/**
 * Luhmann alphanumeric folgezettel: after a numeric segment, children use letter
 * sequences a…z, aa, ab, …; after a letter segment, children use 1, 2, … 9, 10, 11, …
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
        const endsWithLetters = /^[a-z]+$/.test(lastSeg);

        if (endsWithLetters) {
            const pattern = new RegExp(`^${escapeRegex(parentId)}(\\d+)$`);
            const used: number[] = [];
            for (const id of ids) {
                const m = id.match(pattern);
                if (m) used.push(parseInt(m[1], 10));
            }
            const max = used.length > 0 ? Math.max(...used) : 0;
            return parentId + (max + 1).toString();
        }

        const pattern = new RegExp(`^${escapeRegex(parentId)}([a-z]+)$`);
        let maxLetterIndex = 0;
        for (const id of ids) {
            const m = id.match(pattern);
            if (m) {
                const idx = lettersToIndex(m[1]);
                if (!Number.isNaN(idx)) maxLetterIndex = Math.max(maxLetterIndex, idx);
            }
        }
        return parentId + indexToLetters(maxLetterIndex + 1);
    }

    parseId(id: string): ParsedId {
        const segments = parseLuhmannSegments(id);
        if (segments.length <= 1) return { parentId: null, depth: 0 };
        return { parentId: segments.slice(0, -1).join(''), depth: segments.length - 1 };
    }
}
