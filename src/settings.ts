import { App, PluginSettingTab } from "obsidian";
import type MyPlugin from "./main";
import type { PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {};

export class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
  }
}
