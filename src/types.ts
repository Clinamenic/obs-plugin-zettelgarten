/** Optional frontmatter keys controlled by the note template schema (YAML keys differ). */
export type OptionalTemplateFieldKey =
    | 'title'
    | 'date'
    | 'references'
    | 'tags';

export interface OptionalFieldSpec {
    enabled: boolean;
    /** May contain only allowlisted {{...}} tokens; see template-tokens.ts */
    valueTemplate: string;
}

export interface NoteTemplateSchema {
    /** Literal value for `type:` (no token substitution). */
    typeLiteral: string;
    optionalFields: Record<OptionalTemplateFieldKey, OptionalFieldSpec>;
}

export const DEFAULT_NOTE_TEMPLATE_SCHEMA: NoteTemplateSchema = {
    typeLiteral: 'zettel',
    optionalFields: {
        title: { enabled: true, valueTemplate: '' },
        date: { enabled: true, valueTemplate: '{{date}}' },
        references: { enabled: true, valueTemplate: '{{references}}' },
        tags: { enabled: true, valueTemplate: '[]' },
    },
};

export interface PluginSettings {
    defaultFolder: string;
    /** When true, rename notes to `{zettel-id}.md` or `{zettel-id} {title}.md` when title frontmatter changes. */
    syncFilenameWithTitle: boolean;
    /** Frontmatter for new notes; exclusive source (no external template files). */
    noteTemplateSchema: NoteTemplateSchema;
}

export interface TemplateContext {
    uuid: string;
    zettelId: string;
    parentUuid: string;
    parentId: string;
    references: string[];
    title: string;
    tags: string[];
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
