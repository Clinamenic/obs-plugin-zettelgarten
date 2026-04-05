import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type { MigrationEntry, NoteTreeNode } from './types';
import { createScheme, LuhmannScheme, DecimalScheme, type MigrationNode } from './id-scheme';
import type { PluginSettings } from './types';

// ---------------------------------------------------------------------------
// Collect notes with zettel-id from a folder
// ---------------------------------------------------------------------------

export function collectZettelNotesInFolder(app: App, folderPath: string): TFile[] {
    const normalized = folderPath === '/' ? '' : folderPath;
    return app.vault.getMarkdownFiles().filter(f => {
        const p = f.parent?.path ?? '';
        const norm = p === '/' ? '' : p;
        if (norm !== normalized) return false;
        const cache = app.metadataCache.getFileCache(f);
        return typeof cache?.frontmatter?.['zettel-id'] === 'string';
    });
}

/** All markdown files in the vault that have a `zettel-id` in frontmatter. */
export function collectZettelNotesVaultWide(app: App): TFile[] {
    return app.vault.getMarkdownFiles().filter(f => {
        const cache = app.metadataCache.getFileCache(f);
        return typeof cache?.frontmatter?.['zettel-id'] === 'string';
    });
}

// ---------------------------------------------------------------------------
// Build ID tree from notes
// ---------------------------------------------------------------------------

interface TreeNote {
    file: TFile;
    zettelId: string;
    uuid: string;
    parentUuid: string;
    treeParentId: string | null;
    newId: string;
}

function buildTree(app: App, files: TFile[], scheme: { parseId: (id: string) => { parentId: string | null } }): TreeNote[] {
    const uuidToId: Map<string, string> = new Map();

    const notes: TreeNote[] = files.map(f => {
        const fm = app.metadataCache.getFileCache(f)?.frontmatter ?? {};
        const zettelId = fm['zettel-id'] as string;
        const uuid = fm['uuid'] as string ?? '';
        const parentUuid = fm['parent-uuid'] as string ?? '';
        uuidToId.set(uuid, zettelId);
        return { file: f, zettelId, uuid, parentUuid, treeParentId: null, newId: '' };
    });

    // First pass: resolve parent via parent-uuid
    for (const note of notes) {
        if (note.parentUuid) {
            note.treeParentId = uuidToId.get(note.parentUuid) ?? null;
        }
    }

    // Second pass: fallback to parseId for notes without parent-uuid
    for (const note of notes) {
        if (!note.treeParentId && !note.parentUuid) {
            const parsed = scheme.parseId(note.zettelId);
            note.treeParentId = parsed.parentId;
        }
    }

    return notes;
}

// ---------------------------------------------------------------------------
// Assign new IDs using target scheme
// ---------------------------------------------------------------------------

function assignIds(notes: TreeNote[], targetScheme: LuhmannScheme | DecimalScheme, parentId: string | null): void {
    const children = notes.filter(n => n.treeParentId === parentId);
    children.sort((a, b) => a.zettelId.localeCompare(b.zettelId));

    const migNodes: MigrationNode[] = children.map(c => ({
        zettelId: c.zettelId,
        parentId,
        newId: '',
        children: [],
    }));

    targetScheme.assignMigrationIds(migNodes, parentId);

    children.forEach((child, i) => {
        child.newId = migNodes[i].newId;
        assignIds(notes, targetScheme, child.zettelId);
    });
}

// ---------------------------------------------------------------------------
// Build migration entries
// ---------------------------------------------------------------------------

function buildMigrationEntries(app: App, notes: TreeNote[]): MigrationEntry[] {
    return notes
        .filter(n => n.newId && n.newId !== n.zettelId)
        .map(n => {
            const safeTitle = n.file.basename.replace(/^[^\s-]+ - /, '');
            const hasTitle = n.file.basename.includes(' - ');
            const newBasename = hasTitle ? `${n.newId} - ${safeTitle}` : n.newId;
            const folder = n.file.parent?.path ?? '';
            const newPath = folder ? `${folder}/${newBasename}.md` : `${newBasename}.md`;
            return {
                file: n.file,
                oldId: n.zettelId,
                newId: n.newId,
                oldPath: n.file.path,
                newPath,
            };
        });
}


/**
 * Compute which notes need renames/new IDs for the current hierarchical scheme.
 * Returns empty array if scheme is not hierarchical or nothing changes.
 */
export function computeMigrationEntries(app: App, settings: PluginSettings, files: TFile[]): MigrationEntry[] {
    const scheme = createScheme(app, settings);
    if (!scheme.isHierarchical()) return [];
    if (files.length === 0) return [];
    const notes = buildTree(app, files, scheme);
    assignIds(notes, scheme as LuhmannScheme | DecimalScheme, null);
    return buildMigrationEntries(app, notes);
}

// ---------------------------------------------------------------------------
// Preview modal
// ---------------------------------------------------------------------------

class MigrationPreviewModal extends Modal {
    constructor(
        app: App,
        private entries: MigrationEntry[],
        private onConfirm: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: 'Migrate Zettel IDs', cls: 'zettelgarten-modal-title' });
        contentEl.createEl('p', {
            text: `${this.entries.length} note(s) will be renamed. This operation cannot be undone.`,
            cls: 'zettelgarten-migration-desc',
        });

        const table = contentEl.createEl('table', { cls: 'zettelgarten-migration-table' });
        const thead = table.createEl('thead');
        const hr = thead.createEl('tr');
        hr.createEl('th', { text: 'Current ID' });
        hr.createEl('th', { text: 'New ID' });
        hr.createEl('th', { text: 'New filename' });

        const tbody = table.createEl('tbody');
        for (const entry of this.entries) {
            const tr = tbody.createEl('tr');
            tr.createEl('td', { text: entry.oldId });
            tr.createEl('td', { text: entry.newId });
            tr.createEl('td', { text: entry.newPath.split('/').pop() ?? entry.newPath });
        }

        const btnSetting = new Setting(contentEl);
        btnSetting.addButton(btn =>
            btn.setButtonText('Migrate').setCta().setWarning().onClick(() => {
                this.close();
                this.onConfirm();
            }),
        );
        btnSetting.addButton(btn =>
            btn.setButtonText('Cancel').onClick(() => this.close()),
        );
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

// ---------------------------------------------------------------------------
// Update zettel-id in frontmatter text
// ---------------------------------------------------------------------------

function updateFrontmatterField(content: string, key: string, newValue: string): string {
    const lines = content.split('\n');
    let inFrontmatter = false;
    let fmStart = -1;
    let fmEnd = -1;
    let delimCount = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            delimCount++;
            if (delimCount === 1) { inFrontmatter = true; fmStart = i; }
            if (delimCount === 2) { inFrontmatter = false; fmEnd = i; break; }
            continue;
        }
        if (inFrontmatter && lines[i].startsWith(`${key}:`)) {
            lines[i] = `${key}: "${newValue}"`;
        }
    }

    if (fmStart === -1 || fmEnd === -1) return content;
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Execute migration
// ---------------------------------------------------------------------------

export async function executeMigration(app: App, entries: MigrationEntry[]): Promise<void> {
    const tmpPrefix = '__ztg_tmp_';

    // Pass 1: rename to temp names
    for (const entry of entries) {
        const folder = entry.file.parent?.path ?? '';
        const tmpName = `${tmpPrefix}${entry.file.name}`;
        const tmpPath = folder ? `${folder}/${tmpName}` : tmpName;
        await app.fileManager.renameFile(entry.file, tmpPath);
    }

    // Pass 2: rename to final names, update frontmatter
    for (const entry of entries) {
        const folder = entry.file.parent?.path ?? '';
        const tmpName = `${tmpPrefix}${entry.file.name}`;
        const tmpPath = folder ? `${folder}/${tmpName}` : tmpName;
        const tmpFile = app.vault.getFileByPath(tmpPath);

        if (!tmpFile || !(tmpFile instanceof TFile)) continue;

        let content = await app.vault.read(tmpFile);
        content = updateFrontmatterField(content, 'zettel-id', entry.newId);
        await app.vault.modify(tmpFile, content);
        await app.fileManager.renameFile(tmpFile, entry.newPath);
    }

    new Notice(`Zettelgarten: migrated ${entries.length} note(s)`);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function migrateFolder(app: App, folderPath: string, settings: PluginSettings): Promise<void> {
    const scheme = createScheme(app, settings);

    if (!scheme.isHierarchical()) {
        new Notice('Zettelgarten: migration is only available for hierarchical schemes (Luhmann, Decimal, Custom)');
        return;
    }

    const files = collectZettelNotesInFolder(app, folderPath);
    if (files.length === 0) {
        new Notice('Zettelgarten: no zettel notes found in this folder');
        return;
    }

    const entries = computeMigrationEntries(app, settings, files);
    if (entries.length === 0) {
        new Notice('Zettelgarten: all notes already use the current scheme — nothing to migrate');
        return;
    }

    new MigrationPreviewModal(app, entries, () => executeMigration(app, entries)).open();
}

// Keep NoteTreeNode in scope to avoid TS unused import warning
const _unused: NoteTreeNode | undefined = undefined;
void _unused;
