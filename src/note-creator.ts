import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type { PluginSettings, TemplateContext } from './types';
import { createScheme } from './id-scheme';
import { processTemplate, injectTitle } from './template-processor';

// ---------------------------------------------------------------------------
// Title prompt modal
// ---------------------------------------------------------------------------

class TitlePromptModal extends Modal {
    private inputEl!: HTMLInputElement;
    private confirmed = false;

    constructor(
        app: App,
        private readonly onConfirm: (title: string) => void,
        private readonly onCancel: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'New Zettel Note', cls: 'zettelgarten-modal-title' });

        new Setting(contentEl)
            .setName('Title')
            .setDesc('Optional semantic title — leave blank to use the ID as the filename')
            .addText(text => {
                this.inputEl = text.inputEl;
                text.setPlaceholder('e.g. Elephant Lifespan');
                text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter') this.confirm();
                    if (e.key === 'Escape') { e.preventDefault(); this.cancel(); }
                });
            });

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn =>
            btn.setButtonText('Create').setCta().onClick(() => this.confirm()),
        );
        btnSetting.addButton(btn =>
            btn.setButtonText('Cancel').onClick(() => this.cancel()),
        );

        setTimeout(() => this.inputEl?.focus(), 50);
    }

    onClose(): void {
        if (!this.confirmed) this.onCancel();
        this.contentEl.empty();
    }

    private confirm(): void {
        this.confirmed = true;
        const title = this.inputEl?.value.trim() ?? '';
        this.close();
        this.onConfirm(title);
    }

    private cancel(): void {
        this.confirmed = true;
        this.close();
        this.onCancel();
    }
}

function promptForTitle(app: App): Promise<string | null> {
    return new Promise(resolve => {
        const modal = new TitlePromptModal(
            app,
            title => resolve(title),
            () => resolve(null),
        );
        modal.open();
    });
}

// ---------------------------------------------------------------------------
// Sanitise a string for use in a filename
// ---------------------------------------------------------------------------

function sanitiseFilename(str: string): string {
    return str.replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
}

// ---------------------------------------------------------------------------
// Core note creation
// ---------------------------------------------------------------------------

export interface CreateNoteOpts {
    app: App;
    settings: PluginSettings;
    pluginDir: string;
    context: 'root' | 'derivative' | 'excerpt';
    folderPath: string;
    parentFile?: TFile;
    excerpt?: string;
}

export async function createNote(opts: CreateNoteOpts): Promise<void> {
    const { app, settings, pluginDir, context, folderPath, parentFile, excerpt } = opts;

    const scheme = createScheme(app, settings);

    // Resolve zettel-id
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

        zettelId = await scheme.nextChildId(parentZettelId, folderPath);
        references = [`[[${parentFile.basename}]]`];
    } else {
        const targetFolder = context === 'excerpt'
            ? (settings.defaultFolder || '')
            : folderPath;
        zettelId = await scheme.nextRootId(targetFolder);
        if (context === 'excerpt' && parentFile) {
            references = [`[[${parentFile.basename}]]`];
        }
    }

    // Prompt for title (null = user cancelled)
    const title = await promptForTitle(app);
    if (title === null) return;

    // Build TemplateContext
    const ctx: TemplateContext = {
        uuid: crypto.randomUUID(),
        zettelId,
        parentUuid,
        parentId: parentZettelId,
        references,
        title,
    };

    // Process template
    let frontmatter = await processTemplate(app, settings.templatePath, pluginDir, ctx);

    // Inject title if template did not include {{title}}
    if (title) {
        frontmatter = injectTitle(frontmatter, title);
    }

    // Build body
    let body = '';
    if (context === 'excerpt' && excerpt) {
        const lines = excerpt.split('\n').map(l => `> ${l}`).join('\n');
        body = `\n${lines}\n`;
    }

    const content = frontmatter + body;

    // Build filename and path
    const safeTitle = sanitiseFilename(title);
    const filename = safeTitle
        ? `${zettelId} - ${safeTitle}.md`
        : `${zettelId}.md`;

    const targetFolder = context === 'excerpt'
        ? (settings.defaultFolder || '')
        : folderPath;
    const filePath = targetFolder
        ? `${targetFolder}/${filename}`
        : filename;

    // Create the file
    try {
        const file = await app.vault.create(filePath, content);
        await app.workspace.getLeaf(false).openFile(file);
    } catch (err) {
        new Notice(`Zettelgarten: could not create note — ${String(err)}`);
    }
}
