import { App, PluginSettingTab, Setting } from 'obsidian';
import type ZettelgartenPlugin from './main';
import type { NoteTemplateSchema, OptionalTemplateFieldKey, PluginSettings } from './types';
import { DEFAULT_NOTE_TEMPLATE_SCHEMA } from './types';
import { mergeNoteTemplateSchema, NOTE_TEMPLATE_OPTIONAL_KEYS } from './template-processor';
import { previewNoteTemplateYaml, validateNoteTemplateSchema } from './template-validation';
import { openUnifiedVaultSyncModal } from './vault-sync';

export const DEFAULT_SETTINGS: PluginSettings = {
    defaultFolder: '',
    syncFilenameWithTitle: true,
    noteTemplateSchema: structuredClone(DEFAULT_NOTE_TEMPLATE_SCHEMA),
};

const OPTIONAL_FIELD_LABELS: Record<OptionalTemplateFieldKey, { name: string; desc: string; placeholder: string }> = {
    title: {
        name: 'Title',
        desc: 'YAML key `title`. Use {{title}} for the note title at creation time.',
        placeholder: '{{title}}',
    },
    date: {
        name: 'Date',
        desc: 'YAML key `date`. Typically {{date}} (YYYY-MM-DD).',
        placeholder: '{{date}}',
    },
    timestampIso: {
        name: 'Timestamp ISO',
        desc: 'YAML key `timestamp-iso`. Use {{datetime}} or {{timestamp-iso}}.',
        placeholder: '{{datetime}}',
    },
    references: {
        name: 'References',
        desc: 'YAML key `references`. Use {{references}} for the list of wiki links.',
        placeholder: '{{references}}',
    },
    tags: {
        name: 'Tags',
        desc: 'YAML key `tags`. Use [] for empty array, or {{tags}}.',
        placeholder: '[]',
    },
    parentId: {
        name: 'Parent zettel ID',
        desc: 'YAML key `parent-id`. Use {{parent-id}} for the parent note id when applicable.',
        placeholder: '{{parent-id}}',
    },
};

export class ZettelgartenSettingTab extends PluginSettingTab {
    plugin: ZettelgartenPlugin;

    constructor(app: App, plugin: ZettelgartenPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Zettelgarten' });

        // --- Note Creation ---
        containerEl.createEl('h3', { text: 'Note Creation' });

        containerEl.createEl('p', {
            text: 'New notes use Luhmann-style folgezettel IDs (1, 1a, 1a1, 1b, …).',
            cls: 'zettelgarten-setting-hint',
        });

        new Setting(containerEl)
            .setName('Sync filename with title')
            .setDesc(
                'When enabled, renaming the title property updates the file name to match: `{zettel-id}.md` with no title, ' +
                    'or `{zettel-id} {title}.md` when a title is set. ' +
                    'Only affects notes whose file name already follows this pattern (or the legacy `{zettel-id} - {title}` form).',
            )
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.syncFilenameWithTitle).onChange(async val => {
                    this.plugin.settings.syncFilenameWithTitle = val;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName('Default folder')
            .setDesc('Vault-relative path for new notes created from a text excerpt (leave blank for vault root).')
            .addText(text =>
                text
                    .setPlaceholder('e.g. Zettelkasten')
                    .setValue(this.plugin.settings.defaultFolder)
                    .onChange(async val => {
                        this.plugin.settings.defaultFolder = val.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        // --- Note Template ---
        containerEl.createEl('h3', { text: 'Note Template' });

        containerEl.createEl('p', {
            text: 'New notes get frontmatter from this section only. Core identifiers are always set from the plugin; optional rows can be toggled.',
            cls: 'zettelgarten-setting-hint',
        });

        const schema = mergeNoteTemplateSchema(this.plugin.settings.noteTemplateSchema);

        const fixedEl = containerEl.createDiv({ cls: 'zettelgarten-template-fixed-block' });
        fixedEl.createEl('div', { text: 'Always included', cls: 'zettelgarten-template-subheading' });
        fixedEl.createEl('ul', { cls: 'zettelgarten-template-fixed-list' }, ul => {
            ul.createEl('li', { text: 'uuid (from {{uuid}})' });
            ul.createEl('li', { text: 'zettel-id (from {{zettel-id}})' });
            ul.createEl('li', { text: 'parent-uuid (from {{parent-uuid}})' });
        });

        new Setting(containerEl)
            .setName('Type')
            .setDesc('Literal value for the `type` field (no variables).')
            .addText(text =>
                text
                    .setPlaceholder('zettel')
                    .setValue(schema.typeLiteral)
                    .onChange(async val => {
                        this.plugin.settings.noteTemplateSchema = mergeNoteTemplateSchema(this.plugin.settings.noteTemplateSchema);
                        this.plugin.settings.noteTemplateSchema.typeLiteral = val;
                        await this.plugin.saveSettings();
                        this.renderTemplateFeedback(containerEl);
                    }),
            );

        for (const key of NOTE_TEMPLATE_OPTIONAL_KEYS) {
            const meta = OPTIONAL_FIELD_LABELS[key];
            const spec = schema.optionalFields[key];
            new Setting(containerEl)
                .setName(meta.name)
                .setDesc(meta.desc)
                .addToggle(toggle => {
                    toggle.setValue(spec.enabled).onChange(async val => {
                        this.plugin.settings.noteTemplateSchema = mergeNoteTemplateSchema(this.plugin.settings.noteTemplateSchema);
                        this.plugin.settings.noteTemplateSchema.optionalFields[key].enabled = val;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                })
                .addText(text =>
                    text
                        .setPlaceholder(meta.placeholder)
                        .setValue(spec.valueTemplate)
                        .onChange(async val => {
                            this.plugin.settings.noteTemplateSchema = mergeNoteTemplateSchema(this.plugin.settings.noteTemplateSchema);
                            this.plugin.settings.noteTemplateSchema.optionalFields[key].valueTemplate = val;
                            await this.plugin.saveSettings();
                            this.renderTemplateFeedback(containerEl);
                        }),
                );
        }

        new Setting(containerEl).addButton(btn =>
            btn
                .setButtonText('Reset note template to defaults')
                .onClick(async () => {
                    this.plugin.settings.noteTemplateSchema = structuredClone(DEFAULT_NOTE_TEMPLATE_SCHEMA);
                    await this.plugin.saveSettings();
                    this.display();
                }),
        );

        containerEl.createEl('p', {
            text:
                'Allowed variables: {{uuid}}, {{zettel-id}}, {{parent-uuid}}, {{parent-id}}, {{title}}, {{date-short}}, {{date}}, {{datetime}}, {{timestamp-iso}}, {{references}}, {{tags}}.',
            cls: 'zettelgarten-setting-hint',
        });

        this.renderTemplateFeedback(containerEl);

        containerEl.createEl('h3', { text: 'Existing notes' });
        containerEl.createEl('p', {
            text:
                'Rebuild frontmatter for notes that already have a `zettel-id` and whose `type` matches the template above. ' +
                'Existing values are kept where possible; keys for disabled optional fields are removed.',
            cls: 'zettelgarten-setting-hint',
        });
        new Setting(containerEl).addButton(btn =>
            btn.setButtonText('Apply current settings to existing notes').setCta().onClick(() => {
                openUnifiedVaultSyncModal(this.app, this.plugin.settings);
            }),
        );
    }

    private renderTemplateFeedback(containerEl: HTMLElement): void {
        let wrap = containerEl.querySelector('.zettelgarten-template-preview');
        if (!wrap) {
            wrap = containerEl.createDiv({ cls: 'zettelgarten-template-preview' });
            wrap.createEl('div', { text: 'Preview (sample values)', cls: 'zettelgarten-template-subheading' });
            wrap.createEl('pre', { cls: 'zettelgarten-template-preview-pre' });
        }

        let box = containerEl.querySelector('.zettelgarten-template-validation');
        if (!box || !(box instanceof HTMLElement)) {
            box = containerEl.createDiv({ cls: 'zettelgarten-template-validation' });
        } else {
            box.empty();
        }

        const schema = mergeNoteTemplateSchema(this.plugin.settings.noteTemplateSchema);
        const { valid, errors } = validateNoteTemplateSchema(schema);
        if (valid) {
            box.createEl('div', { text: 'Template validates successfully.', cls: 'zettelgarten-template-validation-ok' });
        } else {
            const errEl = box.createEl('div', { cls: 'zettelgarten-template-validation-error' });
            errEl.createEl('div', { text: 'Issues:' });
            const ul = errEl.createEl('ul');
            for (const e of errors) {
                ul.createEl('li', { text: e });
            }
        }

        const pre = containerEl.querySelector('.zettelgarten-template-preview-pre');
        if (pre) {
            pre.setText(previewNoteTemplateYaml(schema));
        }
    }
}
