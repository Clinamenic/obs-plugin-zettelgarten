import { parseYaml } from 'obsidian';
import type { NoteTemplateSchema, TemplateContext } from './types';
import { buildFrontmatterFromSchema, NOTE_TEMPLATE_OPTIONAL_KEYS } from './template-processor';
import { validateTemplateTokensInString } from './template-tokens';

export const SAMPLE_TEMPLATE_CONTEXT: TemplateContext = {
    uuid: '00000000-0000-4000-8000-000000000001',
    zettelId: '1',
    parentUuid: '',
    parentId: '',
    references: ['[[Sample parent]]'],
    title: 'Sample title',
    tags: [],
};

function extractYamlBlock(frontmatter: string): string | null {
    const m = frontmatter.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?$/);
    return m ? m[1] : null;
}

export function validateNoteTemplateSchema(schema: NoteTemplateSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!schema.typeLiteral?.trim()) {
        errors.push('Type cannot be empty.');
    }

    for (const key of NOTE_TEMPLATE_OPTIONAL_KEYS) {
        const spec = schema.optionalFields[key];
        if (!spec?.enabled) continue;
        const tokenErrs = validateTemplateTokensInString(spec.valueTemplate);
        for (const e of tokenErrs) {
            errors.push(`${key}: ${e}`);
        }
    }

    try {
        const built = buildFrontmatterFromSchema(SAMPLE_TEMPLATE_CONTEXT, schema);
        const yaml = extractYamlBlock(built);
        if (yaml === null) {
            errors.push('Generated frontmatter could not be parsed for preview.');
        } else {
            parseYaml(yaml);
        }
    } catch (e) {
        errors.push(`YAML validation failed: ${String(e)}`);
    }

    return { valid: errors.length === 0, errors };
}

export function previewNoteTemplateYaml(schema: NoteTemplateSchema): string {
    try {
        return buildFrontmatterFromSchema(SAMPLE_TEMPLATE_CONTEXT, schema);
    } catch (e) {
        return `Error: ${String(e)}`;
    }
}
