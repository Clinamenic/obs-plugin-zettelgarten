import { App, Notice, TFile } from 'obsidian';
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

    // Build body
    let body = '';
    if (context === 'excerpt' && excerpt) {
        const lines = excerpt.split('\n').map(l => `> ${l}`).join('\n');
        body = `\n${lines}\n`;
    }

    const content = frontmatter + body;

    // Filename is always just the zettel-id (title is filled in by the user)
    const targetFolder = context === 'excerpt'
        ? (settings.defaultFolder || '')
        : folderPath;
    const filePath = targetFolder
        ? `${targetFolder}/${zettelId}.md`
        : `${zettelId}.md`;

    // Create the file and open it with cursor in the content area
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
    } catch (err) {
        new Notice(`Zettelgarten: could not create note — ${String(err)}`);
    }
}
