import { parseYaml, stringifyYaml } from 'obsidian';
import { Notice } from 'obsidian';
import type { NoteTemplateSchema, OptionalTemplateFieldKey, PluginSettings, TemplateContext } from './types';
import { DEFAULT_NOTE_TEMPLATE_SCHEMA } from './types';

export const DEFAULT_TEMPLATE_CONTENT = `---
uuid: "{{uuid}}"
zettel-id: "{{zettel-id}}"
parent-uuid: "{{parent-uuid}}"
title:
type: zettel
date: "{{date}}"
timestamp-iso: "{{datetime}}"
tags: []
references: "{{references}}"
---
`;

export function resolveToken(value: string, ctx: TemplateContext): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateShort = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const dateIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const datetime = `${dateIso}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return value
        .replace(/\{\{uuid\}\}/g, ctx.uuid)
        .replace(/\{\{zettel-id\}\}/g, ctx.zettelId)
        .replace(/\{\{parent-uuid\}\}/g, ctx.parentUuid)
        .replace(/\{\{parent-id\}\}/g, ctx.parentId)
        .replace(/\{\{title\}\}/g, ctx.title)
        .replace(/\{\{date-short\}\}/g, dateShort)
        .replace(/\{\{date\}\}/g, dateIso)
        .replace(/\{\{datetime\}\}/g, datetime)
        .replace(/\{\{timestamp-iso\}\}/g, datetime)
        .replace(/\{\{tags\}\}/g, () => JSON.stringify(ctx.tags));
}

function resolveOptionalFieldValue(
    fieldKey: keyof NoteTemplateSchema['optionalFields'],
    valueTemplate: string,
    ctx: TemplateContext,
): unknown {
    const t = valueTemplate.trim();

    if (fieldKey === 'references') {
        if (t === '{{references}}') return ctx.references;
        return resolveToken(valueTemplate, ctx);
    }

    if (fieldKey === 'tags') {
        if (t === '{{tags}}') return ctx.tags;
        if (t === '[]' || t === '') return [];
        const resolved = resolveToken(valueTemplate, ctx).trim();
        if (resolved === '[]') return [];
        try {
            const parsed = parseYaml(`tags: ${resolved}`);
            const v = (parsed as { tags?: unknown })?.tags;
            return Array.isArray(v) ? v : ctx.tags;
        } catch {
            return ctx.tags;
        }
    }

    if (fieldKey === 'title') {
        if (t === '' || t === '{{title}}') return ctx.title ? ctx.title : null;
        const resolved = resolveToken(valueTemplate, ctx);
        return resolved ? resolved : null;
    }

    return resolveToken(valueTemplate, ctx);
}

export function buildFrontmatterFromSchema(ctx: TemplateContext, schema: NoteTemplateSchema): string {
    const typeLit = schema.typeLiteral.trim() || 'zettel';
    const record: Record<string, unknown> = {};

    record.uuid = ctx.uuid;
    record['zettel-id'] = ctx.zettelId;
    record['parent-uuid'] = ctx.parentUuid ?? '';

    const opt = schema.optionalFields;

    if (opt.title.enabled) {
        record.title = resolveOptionalFieldValue('title', opt.title.valueTemplate, ctx);
    }

    record.type = typeLit;

    if (opt.date.enabled) {
        record.date = resolveOptionalFieldValue('date', opt.date.valueTemplate, ctx);
    }

    if (opt.timestampIso.enabled) {
        record['timestamp-iso'] = resolveOptionalFieldValue('timestampIso', opt.timestampIso.valueTemplate, ctx);
    }

    if (opt.tags.enabled) {
        record.tags = resolveOptionalFieldValue('tags', opt.tags.valueTemplate, ctx);
    }

    if (opt.references.enabled) {
        record.references = resolveOptionalFieldValue('references', opt.references.valueTemplate, ctx);
    }

    if (opt.parentId.enabled) {
        record['parent-id'] = resolveOptionalFieldValue('parentId', opt.parentId.valueTemplate, ctx);
    }

    return buildFrontmatter(record);
}

export function buildFrontmatter(record: Record<string, unknown>): string {
    return `---\n${stringifyYaml(record)}---\n`;
}

export function buildDefaultRecord(ctx: TemplateContext): Record<string, unknown> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const datetime = `${dateIso}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return {
        uuid: ctx.uuid,
        'zettel-id': ctx.zettelId,
        'parent-uuid': ctx.parentUuid,
        title: ctx.title || null,
        type: 'zettel',
        date: dateIso,
        'timestamp-iso': datetime,
        tags: ctx.tags ?? [],
        references: ctx.references,
    };
}

/**
 * Builds YAML frontmatter for a new note from settings. On failure, falls back to defaults and notifies once.
 */
export const NOTE_TEMPLATE_OPTIONAL_KEYS: OptionalTemplateFieldKey[] = [
    'title',
    'date',
    'timestampIso',
    'references',
    'tags',
    'parentId',
];

/** Deep-merge saved schema with defaults so partial or older saves stay valid. */
export function mergeNoteTemplateSchema(s: NoteTemplateSchema | undefined): NoteTemplateSchema {
    if (!s) return structuredClone(DEFAULT_NOTE_TEMPLATE_SCHEMA);
    const opt = { ...DEFAULT_NOTE_TEMPLATE_SCHEMA.optionalFields };
    for (const k of NOTE_TEMPLATE_OPTIONAL_KEYS) {
        const patch = s.optionalFields?.[k];
        opt[k] = {
            enabled: patch?.enabled ?? opt[k].enabled,
            valueTemplate: patch?.valueTemplate ?? opt[k].valueTemplate,
        };
    }
    return {
        typeLiteral: (s.typeLiteral ?? DEFAULT_NOTE_TEMPLATE_SCHEMA.typeLiteral).trim() || DEFAULT_NOTE_TEMPLATE_SCHEMA.typeLiteral,
        optionalFields: opt,
    };
}

export function processTemplate(settings: PluginSettings, ctx: TemplateContext): string {
    const schema = mergeNoteTemplateSchema(settings.noteTemplateSchema);
    try {
        return buildFrontmatterFromSchema(ctx, schema);
    } catch (e) {
        console.error('Zettelgarten processTemplate', e);
        new Notice('Zettelgarten: template error; using default frontmatter.');
        return buildFrontmatter(buildDefaultRecord(ctx));
    }
}
