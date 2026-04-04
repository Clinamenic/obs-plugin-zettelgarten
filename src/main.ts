import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ZettelgartenSettingTab } from './settings';
import { registerContextMenus } from './context-menu';
import { ensureDefaultTemplate } from './template-processor';
import type { PluginSettings } from './types';

export default class ZettelgartenPlugin extends Plugin {
    settings: PluginSettings = { ...DEFAULT_SETTINGS };

    async onload(): Promise<void> {
        await this.loadSettings();

        const pluginDir = this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`;

        await ensureDefaultTemplate(this.app, pluginDir);

        this.addSettingTab(new ZettelgartenSettingTab(this.app, this));

        registerContextMenus(this, pluginDir);
    }

    onunload(): void {}

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
