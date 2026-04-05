import { addIcon, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ZettelgartenSettingTab } from './settings';
import { registerContextMenus } from './context-menu';
import { ensureDefaultTemplate } from './template-processor';
import type { PluginSettings } from './types';

const ZETA_ICON_ID = 'zettelgarten-zeta';

// Lowercase zeta glyph rendered as an SVG path, sized for a 24x24 Lucide-style icon
const ZETA_SVG = `<text x="12" y="18" text-anchor="middle" font-size="18" font-family="serif" font-style="italic" fill="currentColor" stroke="none">&#950;</text>`;

export default class ZettelgartenPlugin extends Plugin {
    settings: PluginSettings = { ...DEFAULT_SETTINGS };

    async onload(): Promise<void> {
        await this.loadSettings();

        const pluginDir = this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`;

        await ensureDefaultTemplate(this.app, pluginDir);

        this.addSettingTab(new ZettelgartenSettingTab(this.app, this));

        addIcon(ZETA_ICON_ID, ZETA_SVG);

        this.addRibbonIcon(ZETA_ICON_ID, 'Zettelgarten settings', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setting = (this.app as any).setting;
            setting.open();
            setting.openTabById(this.manifest.id);
        });

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
