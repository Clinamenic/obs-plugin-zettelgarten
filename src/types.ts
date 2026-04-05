import type { TFile } from 'obsidian';

export type SchemeType = 'luhmann' | 'decimal' | 'timestamp' | 'sequential' | 'custom';

export interface PluginSettings {
    scheme: SchemeType;
    customRootTemplate: string;
    customChildTemplate: string;
    defaultFolder: string;
    templatePath: string;
    /** When true, rename notes to `{zettel-id}.md` or `{zettel-id} {title}.md` when title frontmatter changes. */
    syncFilenameWithTitle: boolean;
}

export interface TemplateContext {
    uuid: string;
    zettelId: string;
    parentUuid: string;
    parentId: string;
    references: string[];
    title: string;
}

export interface ZettelNote {
    uuid: string;
    zettelId: string;
    parentUuid: string;
    title: string;
    filePath: string;
}

export interface ParsedId {
    parentId: string | null;
    depth: number;
}

export interface MigrationEntry {
    file: TFile;
    oldId: string;
    newId: string;
    oldPath: string;
    newPath: string;
}

export interface NoteTreeNode {
    file: TFile;
    zettelId: string;
    uuid: string;
    parentUuid: string | null;
    children: NoteTreeNode[];
    newId: string;
}
