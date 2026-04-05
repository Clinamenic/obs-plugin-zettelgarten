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

function coerceString(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return '';
}

function coerceStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map(x => String(x));
}

/**
 * Rebuild frontmatter record from existing parsed YAML + current schema.
 * Preserves values for enabled keys when present; fills missing keys via template resolution; omits disabled keys.
 */
export function buildRecordForExistingNote(
    existing: Record<string, unknown>,
    schema: NoteTemplateSchema,
): Record<string, unknown> {
    const typeLit = schema.typeLiteral.trim() || 'zettel';
    const uuid =
        typeof existing.uuid === 'string' && existing.uuid.trim() ? existing.uuid : crypto.randomUUID();
    const zettelId = coerceString(existing['zettel-id']);
    const parentUuid = coerceString(existing['parent-uuid']);
    const parentId = coerceString(existing['parent-id']);
    const title = coerceString(existing.title);
    const references = coerceStringArray(existing.references);
    const tags = coerceStringArray(existing.tags);

    const ctx: TemplateContext = { uuid, zettelId, parentUuid, parentId, references, title, tags };

    const record: Record<string, unknown> = {};
    record.uuid = uuid;
    record['zettel-id'] = zettelId;
    record['parent-uuid'] = parentUuid;

    const opt = schema.optionalFields;

    if (opt.title.enabled) {
        if (Object.prototype.hasOwnProperty.call(existing, 'title') && existing.title !== undefined) {
            record.title = existing.title;
        } else {
            record.title = resolveOptionalFieldValue('title', opt.title.valueTemplate, ctx);
        }
    }

    record.type = typeLit;

    if (opt.date.enabled) {
        if (Object.prototype.hasOwnProperty.call(existing, 'date') && existing.date !== undefined) {
            record.date = existing.date;
        } else {
            record.date = resolveOptionalFieldValue('date', opt.date.valueTemplate, ctx);
        }
    }

    if (opt.timestampIso.enabled) {
        const k = 'timestamp-iso';
        if (Object.prototype.hasOwnProperty.call(existing, k) && existing[k] !== undefined) {
            record[k] = existing[k];
        } else {
            record[k] = resolveOptionalFieldValue('timestampIso', opt.timestampIso.valueTemplate, ctx);
        }
    }

    if (opt.tags.enabled) {
        if (Object.prototype.hasOwnProperty.call(existing, 'tags') && existing.tags !== undefined) {
            record.tags = existing.tags;
        } else {
            record.tags = resolveOptionalFieldValue('tags', opt.tags.valueTemplate, ctx);
        }
    }

    if (opt.references.enabled) {
        if (Object.prototype.hasOwnProperty.call(existing, 'references') && existing.references !== undefined) {
            record.references = existing.references;
        } else {
            record.references = resolveOptionalFieldValue('references', opt.references.valueTemplate, ctx);
        }
    }

    if (opt.parentId.enabled) {
        const k = 'parent-id';
        if (Object.prototype.hasOwnProperty.call(existing, k) && existing[k] !== undefined) {
            record[k] = existing[k];
        } else {
            record[k] = resolveOptionalFieldValue('parentId', opt.parentId.valueTemplate, ctx);
        }
    }

    return record;
}

/** Replace first YAML frontmatter block with a new record, or prepend frontmatter if none. */
export function replaceFrontmatterInContent(content: string, record: Record<string, unknown>): string {
    const block = buildFrontmatter(record);
    const re = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
    if (re.test(content)) {
        return content.replace(re, block);
    }
    return block + content;
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
