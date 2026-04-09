import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ZettelgartenSettingTab } from './settings';
import { registerContextMenus } from './context-menu';
import { registerTitleFilenameSync } from './title-filename-sync';
import { mergeNoteTemplateSchema } from './template-processor';
import type { PluginSettings } from './types';

export default class ZettelgartenPlugin extends Plugin {
    settings: PluginSettings = { ...DEFAULT_SETTINGS };

    async onload(): Promise<void> {
        await this.loadSettings();

        this.addSettingTab(new ZettelgartenSettingTab(this.app, this));

        const ribbonEl = this.addRibbonIcon('gear', 'Zettelgarten settings', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById(this.manifest.id);
        });

        // Replace the gear SVG with an italic serif zeta character
        ribbonEl.empty();
        ribbonEl.createEl('span', { text: 'ζ', cls: 'zettelgarten-ribbon-zeta' });

        registerTitleFilenameSync(this);

        registerContextMenus(this);
    }

    onunload(): void {}

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        const legacy = this.settings as unknown as Record<string, unknown>;
        delete legacy.scheme;
        delete legacy.customRootTemplate;
        delete legacy.customChildTemplate;
        const rawOpt = this.settings.noteTemplateSchema?.optionalFields as Record<string, unknown> | undefined;
        if (rawOpt) {
            delete rawOpt.timestampIso;
            delete rawOpt.parentId;
        }
        this.settings.noteTemplateSchema = mergeNoteTemplateSchema(this.settings.noteTemplateSchema);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
