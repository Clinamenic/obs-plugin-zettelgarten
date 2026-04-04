import { parseYaml, stringifyYaml } from 'obsidian';
import type { App } from 'obsidian';
import type { TemplateContext } from './types';

export const DEFAULT_TEMPLATE_CONTENT = `---
uuid: "{{uuid}}"
zettel-id: "{{zettel-id}}"
parent-uuid: "{{parent-uuid}}"
title:
type: zettel
date: "{{date-short}}"
created: "{{datetime}}"
tags: []
references: "{{references}}"
---
`;

function resolveToken(value: string, ctx: TemplateContext): string {
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
        .replace(/\{\{datetime\}\}/g, datetime);
}

function extractFrontmatter(content: string): { yaml: string; body: string } | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return null;
    return { yaml: match[1], body: match[2] };
}

export async function processTemplate(
    app: App,
    templatePath: string,
    pluginDir: string,
    ctx: TemplateContext,
): Promise<string> {
    let templateContent: string;
    const pathToTry = templatePath || `${pluginDir}/default-template.md`;

    try {
        templateContent = await app.vault.adapter.read(pathToTry);
    } catch {
        templateContent = DEFAULT_TEMPLATE_CONTENT;
    }

    const extracted = extractFrontmatter(templateContent);
    if (!extracted) {
        return buildFrontmatter(buildDefaultRecord(ctx));
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = (parseYaml(extracted.yaml) as Record<string, unknown>) ?? {};
    } catch {
        return buildFrontmatter(buildDefaultRecord(ctx));
    }

    const resolved: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'string') {
            if (val === '{{references}}') {
                resolved[key] = ctx.references;
            } else {
                resolved[key] = resolveToken(val, ctx);
            }
        } else {
            resolved[key] = val;
        }
    }

    return buildFrontmatter(resolved);
}

function buildFrontmatter(record: Record<string, unknown>): string {
    return `---\n${stringifyYaml(record)}---\n`;
}

function buildDefaultRecord(ctx: TemplateContext): Record<string, unknown> {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateShort = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const dateIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const datetime = `${dateIso}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    return {
        uuid: ctx.uuid,
        'zettel-id': ctx.zettelId,
        'parent-uuid': ctx.parentUuid,
        title: ctx.title || null,
        type: 'zettel',
        date: dateShort,
        created: datetime,
        tags: [],
        references: ctx.references,
    };
}

export function injectTitle(frontmatter: string, title: string): string {
    if (!title) return frontmatter;
    const extracted = extractFrontmatter(frontmatter + '\n');
    if (!extracted) return frontmatter;

    let parsed: Record<string, unknown>;
    try {
        parsed = (parseYaml(extracted.yaml) as Record<string, unknown>) ?? {};
    } catch {
        return frontmatter;
    }

    if (parsed['title'] === null || parsed['title'] === undefined || parsed['title'] === '') {
        parsed['title'] = title;
        return buildFrontmatter(parsed);
    }
    return frontmatter;
}

export async function ensureDefaultTemplate(app: App, pluginDir: string): Promise<void> {
    const path = `${pluginDir}/default-template.md`;
    const exists = await app.vault.adapter.exists(path);
    if (!exists) {
        await app.vault.adapter.write(path, DEFAULT_TEMPLATE_CONTENT);
    }
}
