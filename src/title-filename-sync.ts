import { Notice, TFile, normalizePath } from 'obsidian';
import type { CachedMetadata, Plugin } from 'obsidian';
import type { PluginSettings } from './types';

const DEBOUNCE_MS = 1000;

/** Strip/replace characters that cannot appear in cross-platform filenames. */
export function sanitizeTitleForFilename(raw: string): string {
    let s = raw.replace(/[\\/:*?"<>|\n\r\t]/g, '-');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
}

export function buildDesiredBasename(zettelId: string, title: string): string {
    const id = zettelId.trim();
    if (!id) return '';
    const sanitized = sanitizeTitleForFilename(title);
    if (!sanitized) return id;
    return `${id} ${sanitized}`;
}

function coerceTitle(value: unknown): string | null {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
}

/** Basename matches plugin-managed naming so we do not rename arbitrary files. */
export function isEligibleBasename(basenameWithoutExt: string, zettelId: string): boolean {
    const id = zettelId.trim();
    if (!id) return false;
    if (basenameWithoutExt === id) return true;
    if (basenameWithoutExt.startsWith(`${id} `)) return true;
    if (basenameWithoutExt.startsWith(`${id} - `)) return true;
    return false;
}

function folderPrefixForFile(file: TFile): string {
    const p = file.parent?.path ?? '';
    if (p === '' || p === '/') return '';
    return p;
}

function pathForBasename(file: TFile, basenameNoExt: string): string {
    const dir = folderPrefixForFile(file);
    const name = `${basenameNoExt}.md`;
    return dir ? normalizePath(`${dir}/${name}`) : normalizePath(name);
}

async function maybeRenameFromTitle(
    plugin: Pick<Plugin, 'app' | 'registerEvent'> & { settings: PluginSettings },
    pathKey: string,
): Promise<void> {
    if (!plugin.settings.syncFilenameWithTitle) return;

    const { app } = plugin;
    const abstract = app.vault.getAbstractFileByPath(pathKey);
    if (!abstract || !(abstract instanceof TFile)) return;
    if (abstract.extension !== 'md') return;

    const cache = app.metadataCache.getFileCache(abstract);
    if (!cache?.frontmatter) return;

    const zid = cache.frontmatter['zettel-id'];
    if (typeof zid !== 'string' || !zid.trim()) return;

    const titleRaw = coerceTitle(cache.frontmatter['title']);
    if (titleRaw === null) return;

    const desiredBase = buildDesiredBasename(zid, titleRaw);
    if (!desiredBase) return;

    const currentBase = abstract.basename;
    if (currentBase === desiredBase) return;

    if (!isEligibleBasename(currentBase, zid)) return;

    const normalizedNew = pathForBasename(abstract, desiredBase);
    if (normalizePath(abstract.path) === normalizedNew) return;

    const collision = app.vault.getAbstractFileByPath(normalizedNew);
    if (collision && collision !== abstract) {
        new Notice('Zettelgarten: cannot rename — a file with that name already exists.');
        return;
    }

    try {
        await app.fileManager.renameFile(abstract, normalizedNew);
    } catch (e) {
        new Notice(`Zettelgarten: rename failed — ${String(e)}`);
    }
}

type Host = Pick<Plugin, 'app' | 'registerEvent'> & { settings: PluginSettings };

export function registerTitleFilenameSync(plugin: Host): void {
    const pending = new Map<string, number>();

    const clearTimer = (path: string): void => {
        const t = pending.get(path);
        if (t !== undefined) {
            window.clearTimeout(t);
            pending.delete(path);
        }
    };

    const schedule = (path: string): void => {
        clearTimer(path);
        const id = window.setTimeout(() => {
            pending.delete(path);
            void maybeRenameFromTitle(plugin, path);
        }, DEBOUNCE_MS);
        pending.set(path, id);
    };

    plugin.registerEvent(
        plugin.app.metadataCache.on('changed', (file: TFile, _data: string, cache: CachedMetadata) => {
            if (!plugin.settings.syncFilenameWithTitle) return;
            if (!(file instanceof TFile) || file.extension !== 'md') return;
            const zid = cache?.frontmatter?.['zettel-id'];
            if (typeof zid !== 'string' || !zid.trim()) return;
            schedule(file.path);
        }),
    );

    plugin.registerEvent(
        plugin.app.vault.on('rename', (_file, oldPath: string) => {
            clearTimer(oldPath);
        }),
    );
}
