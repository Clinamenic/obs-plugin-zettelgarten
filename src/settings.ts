import { App, PluginSettingTab, Setting } from 'obsidian';
import type ZettelgartenPlugin from './main';
import type { PluginSettings, SchemeType } from './types';

export const DEFAULT_SETTINGS: PluginSettings = {
    scheme: 'luhmann',
    customRootTemplate: '{n}',
    customChildTemplate: '{parent}{letter}',
    defaultFolder: '',
    templatePath: '',
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

        // --- ID Scheme ---
        containerEl.createEl('h3', { text: 'ID Scheme' });

        new Setting(containerEl)
            .setName('Naming scheme')
            .setDesc('The identifier scheme used when creating new zettel notes.')
            .addDropdown(drop => {
                const options: Record<SchemeType, string> = {
                    luhmann:    'Luhmann Alphanumeric (1, 1a, 1a1, 1b…)',
                    decimal:    'Decimal (1, 1.1, 1.1.1, 1.2…)',
                    timestamp:  'Timestamp (YYYYMMDDHHMM)',
                    sequential: 'Sequential (001, 002, 003…)',
                    custom:     'Custom template',
                };
                Object.entries(options).forEach(([val, label]) => drop.addOption(val, label));
                drop.setValue(this.plugin.settings.scheme);
                drop.onChange(async val => {
                    this.plugin.settings.scheme = val as SchemeType;
                    await this.plugin.saveSettings();
                    this.display();
                });
            });

        if (this.plugin.settings.scheme === 'custom') {
            new Setting(containerEl)
                .setName('Root ID template')
                .setDesc('Template for new root notes. Variables: {n}, {letter}, {YYYY}, {MM}, {DD}, {HH}, {mm}')
                .addText(text =>
                    text
                        .setPlaceholder('{n}')
                        .setValue(this.plugin.settings.customRootTemplate)
                        .onChange(async val => {
                            this.plugin.settings.customRootTemplate = val;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName('Child ID template')
                .setDesc('Template for derivative notes. Variables: {parent}, {n}, {letter}, {YYYY}, {MM}, {DD}, {HH}, {mm}')
                .addText(text =>
                    text
                        .setPlaceholder('{parent}{letter}')
                        .setValue(this.plugin.settings.customChildTemplate)
                        .onChange(async val => {
                            this.plugin.settings.customChildTemplate = val;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // --- Note Creation ---
        containerEl.createEl('h3', { text: 'Note Creation' });

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

        // --- Template ---
        containerEl.createEl('h3', { text: 'Note Template' });

        new Setting(containerEl)
            .setName('Template file path')
            .setDesc(
                'Vault-relative path to a Markdown file used as the frontmatter template. ' +
                'Supports any path including hidden directories (e.g. .obsidian/my-template.md). ' +
                'Leave blank to use the built-in default template.',
            )
            .addText(text =>
                text
                    .setPlaceholder('.obsidian/plugins/zettelgarten/default-template.md')
                    .setValue(this.plugin.settings.templatePath)
                    .onChange(async val => {
                        this.plugin.settings.templatePath = val.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createEl('p', {
            text: 'Supported template variables: {{uuid}}, {{zettel-id}}, {{parent-uuid}}, {{parent-id}}, {{title}}, {{date-short}}, {{date}}, {{datetime}}, {{references}}',
            cls: 'zettelgarten-setting-hint',
        });
    }
}
