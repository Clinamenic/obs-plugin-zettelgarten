import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { parseYaml } from 'obsidian';
import type { MigrationEntry } from './types';
import type { PluginSettings } from './types';
import {
    collectZettelNotesVaultWide,
    computeMigrationEntries,
    executeMigration,
} from './migration';
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

class UnifiedVaultSyncModal extends Modal {
    constructor(
        app: App,
        private settings: PluginSettings,
        private idEntries: MigrationEntry[],
        private frontmatterCount: number,
        private onConfirm: () => void | Promise<void>,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        const schema = mergeNoteTemplateSchema(this.settings.noteTemplateSchema);
        const typeLit = schema.typeLiteral;

        contentEl.createEl('h3', { text: 'Apply settings to existing notes', cls: 'zettelgarten-modal-title' });

        contentEl.createEl('p', {
            text:
                'This runs in two steps: (1) rename files and update zettel-ids when your naming scheme requires it; ' +
                '(2) rebuild frontmatter for notes whose type matches the template. Large vaults may take a moment.',
            cls: 'zettelgarten-migration-desc',
        });

        contentEl.createEl('h4', { text: 'Step 1: Naming scheme (IDs)', cls: 'zettelgarten-vault-sync-h4' });
        if (this.idEntries.length === 0) {
            contentEl.createEl('p', {
                text: 'No file renames or zettel-id changes (non-hierarchical scheme, or already aligned).',
                cls: 'zettelgarten-migration-desc',
            });
        } else {
            contentEl.createEl('p', {
                text: `${this.idEntries.length} note(s) will be renamed and zettel-id values updated.`,
                cls: 'zettelgarten-migration-desc',
            });
            const maxRows = 25;
            const table = contentEl.createEl('table', { cls: 'zettelgarten-migration-table' });
            const thead = table.createEl('thead');
            const hr = thead.createEl('tr');
            hr.createEl('th', { text: 'Old ID' });
            hr.createEl('th', { text: 'New ID' });
            const tbody = table.createEl('tbody');
            for (const entry of this.idEntries.slice(0, maxRows)) {
                const tr = tbody.createEl('tr');
                tr.createEl('td', { text: entry.oldId });
                tr.createEl('td', { text: entry.newId });
            }
            if (this.idEntries.length > maxRows) {
                contentEl.createEl('p', {
                    text: `… and ${this.idEntries.length - maxRows} more.`,
                    cls: 'zettelgarten-migration-desc',
                });
            }
        }

        contentEl.createEl('h4', { text: 'Step 2: Frontmatter template', cls: 'zettelgarten-vault-sync-h4' });
        contentEl.createEl('p', {
            text: `Rebuild YAML for up to ${this.frontmatterCount} note(s) with type "${typeLit}" (preserving existing field values where keys stay enabled; keys for disabled optional fields are removed).`,
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
    const allZettel = collectZettelNotesVaultWide(app);
    const idEntries = computeMigrationEntries(app, settings, allZettel);
    const schema = mergeNoteTemplateSchema(settings.noteTemplateSchema);
    const typeLit = schema.typeLiteral;
    const frontmatterCount = collectNotesForTemplateSync(app, typeLit).length;

    if (idEntries.length === 0 && frontmatterCount === 0) {
        new Notice('Zettelgarten: nothing to sync (no matching notes).');
        return;
    }

    new UnifiedVaultSyncModal(app, settings, idEntries, frontmatterCount, async () => {
        if (idEntries.length > 0) {
            await executeMigration(app, idEntries, { silent: true });
        }
        const n = await executeFrontmatterSync(app, settings);
        const parts: string[] = [];
        if (idEntries.length > 0) {
            parts.push(`migrated ${idEntries.length} note(s)`);
        }
        parts.push(`frontmatter updated for ${n} note(s)`);
        new Notice(`Zettelgarten: ${parts.join('; ')}.`);
    }).open();
}
