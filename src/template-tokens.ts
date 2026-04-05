/** Normalized token names inside {{...}} (lowercase, hyphens as stored). */
export const ALLOWED_TEMPLATE_TOKEN_NAMES = new Set([
    'uuid',
    'zettel-id',
    'parent-uuid',
    'parent-id',
    'title',
    'date-short',
    'date',
    'datetime',
    'timestamp-iso',
    'references',
    'tags',
]);

const TOKEN_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g;

function normalizeTokenName(raw: string): string {
    return raw.trim().toLowerCase();
}

/** Returns error messages for unknown tokens, or empty array if valid. */
export function validateTemplateTokensInString(value: string): string[] {
    const errors: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(TOKEN_REGEX.source, 'g');
    while ((m = re.exec(value)) !== null) {
        const name = normalizeTokenName(m[1]);
        if (!ALLOWED_TEMPLATE_TOKEN_NAMES.has(name)) {
            errors.push(`Unknown token {{${m[1].trim()}}}`);
        }
    }
    return errors;
}

export function extractTokenNames(value: string): string[] {
    const names: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(TOKEN_REGEX.source, 'g');
    while ((m = re.exec(value)) !== null) {
        names.push(normalizeTokenName(m[1]));
    }
    return names;
}
