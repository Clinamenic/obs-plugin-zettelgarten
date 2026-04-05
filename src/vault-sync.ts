import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { parseYaml } from 'obsidian';
import type { PluginSettings } from './types';
import {
    buildRecordForExistingNote,
    mergeNoteTemplateSchema,
    replaceFrontmatterInContent,
} from './template-processor';

function frontmatterTypeMatches(fm: Record<string, unknown>, typeLiteral: string): boolean {
    const t = fm['type'];
    const s = t === null || t === undefined ? '' : typeof t === 'string' ? t : String(t);
    return s === typeLiteral;
}

/** Markdown files with a zettel-id and a `type` matching the template literal. */
export function collectNotesForTemplateSync(app: App, typeLiteral: string): TFile[] {
    return app.vault.getMarkdownFiles().filter(f => {
        const fm = app.metadataCache.getFileCache(f)?.frontmatter;
        if (!fm || typeof fm['zettel-id'] !== 'string' || !String(fm['zettel-id']).trim()) return false;
        return frontmatterTypeMatches(fm as Record<string, unknown>, typeLiteral);
    });
}

async function executeFrontmatterSync(app: App, settings: PluginSettings): Promise<number> {
    const schema = mergeNoteTemplateSchema(settings.noteTemplateSchema);
    const typeLit = schema.typeLiteral;
    const files = collectNotesForTemplateSync(app, typeLit);
    let count = 0;
    for (const file of files) {
        const content = await app.vault.read(file);
        const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
        let existing: Record<string, unknown> = {};
        if (m) {
            try {
                existing = (parseYaml(m[1]) as Record<string, unknown>) ?? {};
            } catch {
                continue;
            }
        }
        const record = buildRecordForExistingNote(existing, schema);
        const next = replaceFrontmatterInContent(content, record);
        if (next !== content) {
            await app.vault.modify(file, next);
            count++;
        }
    }
    return count;
}

class FrontmatterVaultSyncModal extends Modal {
    constructor(
        app: App,
        private settings: PluginSettings,
        private frontmatterCount: number,
        private onConfirm: () => void | Promise<void>,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        const schema = mergeNoteTemplateSchema(this.settings.noteTemplateSchema);
        const typeLit = schema.typeLiteral;

        contentEl.createEl('h3', { text: 'Apply template to existing notes', cls: 'zettelgarten-modal-title' });

        contentEl.createEl('p', {
            text:
                'Rebuild frontmatter for notes that have a zettel-id and whose type matches your template. ' +
                'Large vaults may take a moment.',
            cls: 'zettelgarten-migration-desc',
        });

        contentEl.createEl('p', {
            text: `Up to ${this.frontmatterCount} note(s) with type "${typeLit}" (preserving existing field values where keys stay enabled; keys for disabled optional fields are removed).`,
            cls: 'zettelgarten-migration-desc',
        });

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn =>
            btn.setButtonText('Apply').setCta().setWarning().onClick(async () => {
                this.close();
                await this.onConfirm();
            }),
        );
        btnSetting.addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()));
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export function openUnifiedVaultSyncModal(app: App, settings: PluginSettings): void {
    const schema = mergeNoteTemplateSchema(settings.noteTemplateSchema);
    const typeLit = schema.typeLiteral;
    const frontmatterCount = collectNotesForTemplateSync(app, typeLit).length;

    if (frontmatterCount === 0) {
        new Notice('Zettelgarten: no notes match (need zettel-id and matching type).');
        return;
    }

    new FrontmatterVaultSyncModal(app, settings, frontmatterCount, async () => {
        const n = await executeFrontmatterSync(app, settings);
        new Notice(`Zettelgarten: frontmatter updated for ${n} note(s).`);
    }).open();
}
