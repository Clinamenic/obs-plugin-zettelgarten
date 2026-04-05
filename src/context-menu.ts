import type { Editor, MarkdownFileInfo, MarkdownView, Menu, TAbstractFile, TFile } from 'obsidian';
import { TFolder } from 'obsidian';
import type ZettelgartenPlugin from './main';
import { createNote } from './note-creator';
import { migrateFolder } from './migration';

export function registerContextMenus(plugin: ZettelgartenPlugin): void {
    const { app } = plugin;

    plugin.registerEvent(
        app.workspace.on(
            'editor-menu',
            (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
                if (!editor.getSelection()) return;

                menu.addSeparator();
                menu.addItem(item =>
                    item
                        .setTitle('New Zettel from excerpt')
                        .setIcon('quote-glyph')
                        .onClick(() => {
                            const sourceFile = 'file' in info
                                ? (info as MarkdownView).file
                                : app.workspace.getActiveFile();
                            createNote({
                                app,
                                settings: plugin.settings,
                                context: 'excerpt',
                                folderPath: plugin.settings.defaultFolder || '',
                                parentFile: sourceFile ?? undefined,
                                excerpt: editor.getSelection(),
                            });
                        }),
                );
            },
        ),
    );

    plugin.registerEvent(
        app.workspace.on(
            'file-menu',
            (menu: Menu, file: TAbstractFile) => {
                if (file instanceof TFolder) {
                    menu.addSeparator();
                    menu.addItem(item =>
                        item
                            .setTitle('New Zettel here')
                            .setIcon('file-plus')
                            .onClick(() =>
                                createNote({
                                    app,
                                    settings: plugin.settings,
                                    context: 'root',
                                    folderPath: file.path,
                                }),
                            ),
                    );
                    menu.addItem(item =>
                        item
                            .setTitle('Migrate notes to current scheme')
                            .setIcon('arrow-right-left')
                            .onClick(() => migrateFolder(app, file.path, plugin.settings)),
                    );
                } else if (isMarkdownFile(file)) {
                    menu.addSeparator();
                    menu.addItem(item =>
                        item
                            .setTitle('Create derivative note')
                            .setIcon('git-branch')
                            .onClick(() =>
                                createNote({
                                    app,
                                    settings: plugin.settings,
                                    context: 'derivative',
                                    folderPath: file.parent?.path ?? '',
                                    parentFile: file,
                                }),
                            ),
                    );
                }
            },
        ),
    );
}

function isMarkdownFile(file: TAbstractFile): file is TFile {
    return 'extension' in file && (file as TFile).extension === 'md';
}
