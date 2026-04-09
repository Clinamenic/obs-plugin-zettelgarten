import { App, Notice, TFile, normalizePath } from 'obsidian';
import type { PluginSettings, TemplateContext } from './types';
import { LuhmannScheme } from './id-scheme';
import { processTemplate } from './template-processor';

// ---------------------------------------------------------------------------
// Core note creation
// ---------------------------------------------------------------------------

export interface CreateNoteOpts {
    app: App;
    settings: PluginSettings;
    context: 'root' | 'derivative' | 'excerpt';
    folderPath: string;
    parentFile?: TFile;
    excerpt?: string;
}

const MAX_CREATE_ATTEMPTS = 50;

function buildFilePath(folderPath: string, zettelId: string): string {
    return normalizePath(folderPath ? `${folderPath}/${zettelId}.md` : `${zettelId}.md`);
}

function getNextRootId(id: string): string | null {
    if (!/^\d+$/.test(id)) return null;
    return (parseInt(id, 10) + 1).toString();
}

function hasFileExistsError(err: unknown): boolean {
    const msg = String(err).toLowerCase();
    return msg.includes('file already exists') || msg.includes('destination file already exists');
}

function warnOnMismatchedCollision(app: App, collidingPath: string, expectedId: string): void {
    const abstract = app.vault.getAbstractFileByPath(collidingPath);
    if (!(abstract instanceof TFile)) return;
    const cache = app.metadataCache.getFileCache(abstract);
    const existingId = cache?.frontmatter?.['zettel-id'];
    if (typeof existingId === 'string' && existingId.trim() === expectedId) return;
    new Notice(`Zettelgarten: found filename/frontmatter mismatch at ${abstract.name}; skipped to next available id.`);
}

export async function createNote(opts: CreateNoteOpts): Promise<void> {
    const { app, settings, context, folderPath, parentFile, excerpt } = opts;

    const scheme = new LuhmannScheme(app);

    // Resolve zettel-id and parent metadata
    let zettelId: string;
    let parentZettelId = '';
    let parentUuid = '';
    let references: string[] = [];

    if (context === 'derivative' && parentFile) {
        const cache = app.metadataCache.getFileCache(parentFile);
        parentZettelId = cache?.frontmatter?.['zettel-id'] ?? '';
        parentUuid = cache?.frontmatter?.['uuid'] ?? '';

        if (!parentZettelId) {
            new Notice('Zettelgarten: parent note has no zettel-id in frontmatter');
            return;
        }

        zettelId = await scheme.nextChildId(parentZettelId);
        references = [`[[${parentFile.basename}]]`];
    } else {
        zettelId = await scheme.nextRootId();
        if (context === 'excerpt' && parentFile) {
            const cache = app.metadataCache.getFileCache(parentFile);
            parentUuid = cache?.frontmatter?.['uuid'] ?? '';
            references = [`[[${parentFile.basename}]]`];
        }
    }

    // Build body
    let body = '';
    if (context === 'excerpt' && excerpt) {
        const lines = excerpt.split('\n').map(l => `> ${l}`).join('\n');
        body = `\n${lines}\n`;
    }

    // Filename is always just the zettel-id (title is filled in by the user)
    const targetFolder = context === 'excerpt'
        ? (settings.defaultFolder || '')
        : folderPath;

    // For root notes, skip blocked filenames in the target folder.
    if (context === 'root') {
        let scanned = 0;
        while (scanned < MAX_CREATE_ATTEMPTS) {
            const candidatePath = buildFilePath(targetFolder, zettelId);
            if (!app.vault.getAbstractFileByPath(candidatePath)) break;
            warnOnMismatchedCollision(app, candidatePath, zettelId);
            const next = getNextRootId(zettelId);
            if (!next) break;
            zettelId = next;
            scanned++;
        }
    }

    // Create the file and open it with cursor in the content area
    try {
        let attempts = 0;
        while (attempts < MAX_CREATE_ATTEMPTS) {
            // Build TemplateContext (title is blank — user fills it in after creation)
            const ctx: TemplateContext = {
                uuid: crypto.randomUUID(),
                zettelId,
                parentUuid,
                parentId: parentZettelId,
                references,
                title: '',
                tags: [],
            };

            const frontmatter = processTemplate(settings, ctx);
            const content = frontmatter + body;
            const filePath = buildFilePath(targetFolder, zettelId);

            try {
                const file = await app.vault.create(filePath, content);
                const leaf = app.workspace.getLeaf(false);
                await leaf.openFile(file);
                // Move cursor past the frontmatter into the content area
                const view = leaf.view as { editor?: { setCursor: (pos: { line: number; ch: number }) => void; lineCount: () => number } };
                if (view.editor) {
                    const lastLine = view.editor.lineCount() - 1;
                    view.editor.setCursor({ line: lastLine, ch: 0 });
                }
                return;
            } catch (err) {
                if (!(context === 'root' && hasFileExistsError(err))) throw err;
                warnOnMismatchedCollision(app, filePath, zettelId);
                const next = getNextRootId(zettelId);
                if (!next) throw err;
                zettelId = next;
                attempts++;
            }
        }
        new Notice('Zettelgarten: could not create root note after multiple filename collisions.');
    } catch (err) {
        new Notice(`Zettelgarten: could not create note — ${String(err)}`);
    }
}
