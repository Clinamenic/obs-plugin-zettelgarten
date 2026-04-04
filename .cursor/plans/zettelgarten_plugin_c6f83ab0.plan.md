---
name: Zettelgarten Plugin
overview: Build "Zettelgarten", an Obsidian Zettelkasten plugin initialized from the starter-obs-plugin template, with configurable ID schemes, UUID frontmatter generation, and context-menu-driven note creation.
todos:
  - id: init
    content: "Fill all {{...}} placeholders in manifest.json (set isDesktopOnly: true), package.json, doap.json, versions.json, CHANGELOG.md, LICENSE; rename MyPlugin → ZettelgartenPlugin; run npm install && npm run build"
    status: pending
  - id: types
    content: "Define types.ts: PluginSettings interface, SchemeType enum, ZettelNote interface"
    status: pending
  - id: id-scheme
    content: "Implement id-scheme.ts: abstract IdScheme + Decimal, Luhmann, Timestamp, Sequential, Custom scheme classes"
    status: pending
  - id: template-processor
    content: "Implement template-processor.ts: read template file via vault.adapter.read(), parse frontmatter with parseYaml, resolve {{variable}} tokens (uuid, zettel-id, parent-uuid, parent-id, date-short, date, datetime, references); bundle default-template.md in plugin directory as fallback"
    status: pending
  - id: note-creator
    content: "Implement note-creator.ts: build TemplateContext (including parent-uuid lookup for derivative notes), call TemplateProcessor, prompt for optional title, assemble filename and body (blockquote for excerpts), write file"
    status: pending
  - id: migration
    content: "Implement migration.ts: uuid→file map, tree reconstruction via parent-uuid (parseId fallback), new ID assignment, MigrationPreviewModal, execute renames via fileManager.renameFile() + frontmatter updates; hierarchical schemes only"
    status: pending
  - id: context-menu
    content: "Implement context-menu.ts: editor-menu handler (excerpt → note), file-menu handler (derivative note + folder new note)"
    status: pending
  - id: settings
    content: "Implement settings.ts: scheme selector dropdown, custom template inputs, default folder picker, includeParentRef toggle, templatePath input with vault file picker"
    status: pending
  - id: main
    content: "Wire everything in main.ts: ZettelgartenPlugin, register menus, commands, settings tab, load/save settings"
    status: pending
  - id: styles
    content: "Add styles.css: CSS for title prompt modal using Obsidian CSS variables and zettelgarten- prefixed classes"
    status: pending
  - id: build-verify
    content: Run npm run build to verify TypeScript and bundling; fix any errors
    status: pending
  - id: release-prep
    content: Run version-bump.sh, update CHANGELOG.md, commit and tag initial release
    status: pending
isProject: false
---

# Zettelgarten Obsidian Plugin

## Overview

An Obsidian plugin for Zettelkasten note-taking. Plugin id: `zettelgarten`. Repo already exists at `[/Users/gideon/Hub/projects/obs-plugin-zettelgarten/](/Users/gideon/Hub/projects/obs-plugin-zettelgarten/)` — a direct copy of the starter template, still with unfilled `{{...}}` placeholders and the default `MyPlugin` skeleton.

## Zettelkasten Naming Schemes

Five built-in schemes plus one user-defined custom template:

- **Luhmann Alphanumeric** (default) — Luhmann's original folgezettel: `1`, `1a`, `1a1`, `1b`, `1b1a` (alternates numeric/letter per depth level)
- **Decimal** — pure numeric dot notation: `1`, `1.1`, `1.2`, `1.1.1`
- **Timestamp** — 12-digit creation time: `202604041530` (YYYYMMDDHHMM); derivatives append `_1`, `_2`
- **Sequential** — zero-padded global counter: `001`, `002`, `003`
- **Custom Template** — user-defined template strings (see below)

### Custom Template Format

Two separate template strings: one for root notes, one for child/derivative notes.

Template variables:

- `{n}` — auto-incremented integer (next available in scope)
- `{letter}` — auto-incremented lowercase letter (a, b, c...)
- `{parent}` — the parent note's `zettel-id` value
- `{YYYY}`, `{MM}`, `{DD}`, `{HH}`, `{mm}` — current date/time parts

Examples:

- Root: `{n}`, Child: `{parent}.{n}` → reproduces decimal scheme
- Root: `{n}`, Child: `{parent}{letter}` → reproduces Luhmann alphanumeric

The plugin parses existing note frontmatter in the target folder to resolve the next available `{n}` or `{letter}` value.

## Note Structure

Frontmatter is driven entirely by a template `.md` file. The plugin bundles a default template inside the plugin directory; users can create their own and point the plugin to them.

**Default template location:** `.obsidian/plugins/zettelgarten/default-template.md` (ships with the plugin, never modified by the user unless they edit it directly).

**Default template content:**

```yaml
---
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
```

The plugin reads the template file's frontmatter via `app.vault.adapter.read(path)` (the low-level adapter, which can access any vault-relative path including hidden directories like `.obsidian/`), resolves `{{variable}}` tokens in field values, and writes the result as the new note's frontmatter. Static fields (e.g. `type: zettel`) are copied verbatim. The user can freely add, remove, or reorder frontmatter fields in any template file.

**Template resolution — `vault.adapter.read()` is used throughout**, so template files may live anywhere within the vault directory:

- Inside `.obsidian/plugins/zettelgarten/` (default, bundled)
- Inside `.obsidian/` or any other hidden directory
- Anywhere in the visible vault (e.g. `Templates/my-zettel.md`)

**Supported dynamic variables:**

- `{{uuid}}` — UUID v4 via `crypto.randomUUID()`
- `{{zettel-id}}` — the resolved zettel ID for this note (from the active ID scheme)
- `{{parent-uuid}}` — the UUID of the structural parent note (derivative notes only; empty string for root and excerpt notes)
- `{{parent-id}}` — the `zettel-id` string of the parent note (derivative notes only; empty string otherwise)
- `{{date-short}}` — current date in Obsidian's standard short format (`MM/DD/YYYY`)
- `{{date}}` — current date in ISO format (`YYYY-MM-DD`)
- `{{datetime}}` — current date-time in ISO format (`YYYY-MM-DDTHH:mm:ss`)
- `{{references}}` — **list-type variable**: resolves to a YAML list of `[[wikilinks]]` pointing to the source note(s); empty (`[]`) for root notes created from a folder; populated for excerpt and derivative notes (see below)

`{{references}}` is handled specially by the template processor: when a field's value is `{{references}}`, the processor emits a proper YAML list rather than a string. Resolved forms:

- Root note (folder context): `references: []`
- Excerpt note: `references:\n  - "[[{source filename}]]"`
- Derivative note: `references:\n  - "[[{parent filename}]]"`

Frontmatter is parsed from the raw template text using Obsidian's bundled `parseYaml` utility (since `metadataCache` does not index hidden directories).

**Filename:** `{zettel-id} - {title}.md` when the resolved `title` field is non-empty; `{zettel-id}.md` otherwise.

**Body** (for excerpt-sourced notes): the highlighted text is inserted as a Markdown blockquote below the frontmatter. The source note is not modified.

## Architecture

Plugin directory: `/Users/gideon/Hub/projects/obs-plugin-zettelgarten/`. Desktop-only (`isDesktopOnly: true` in manifest).

Source file layout under `src/`:

- [`src/main.ts`] — `ZettelgartenPlugin` class; registers all commands, menus, and settings tab
- [`src/types.ts`] — `PluginSettings`, `SchemeType` enum, `ZettelNote` metadata interface, `TemplateContext` interface
- [`src/settings.ts`] — `ZettelgartenSettingTab`; scheme selector, custom template inputs, default folder, template file path
- [`src/id-scheme.ts`] — `IdScheme` abstract class + `DecimalScheme`, `LuhmannScheme`, `TimestampScheme`, `SequentialScheme`, `CustomScheme` implementations; each exposes `nextRootId(folder)`, `nextChildId(parentId, folder)`, and `parseId(id)` (for migration fallback on notes missing `parent-uuid`)
- [`src/template-processor.ts`] — reads a template `.md` file via `vault.adapter.read(path)`, parses its frontmatter with `parseYaml`, resolves `{{variable}}` tokens against a `TemplateContext`, handles list-type variables (`{{references}}`), and returns a resolved frontmatter string; the bundled default template at `.obsidian/plugins/zettelgarten/default-template.md` is the fallback when no custom path is configured
- [`src/note-creator.ts`] — `createNote(opts)`: resolves ID via active scheme, builds `TemplateContext` (including `parent-uuid` lookup for derivative notes), calls `TemplateProcessor`, prompts for optional title, assembles and writes the final file
- [`src/migration.ts`] — bulk ID scheme migration: builds a `uuid → file` map, reconstructs the note tree via `parent-uuid` links (falls back to `parseId()` for notes lacking `parent-uuid`), computes new ID assignments, shows a preview modal, then executes renames via `fileManager.renameFile()` and frontmatter updates; only offered between hierarchical schemes (Luhmann, Decimal, Custom); scoped to a folder via file explorer right-click
- [`src/context-menu.ts`] — registers editor-menu and file-menu handlers

## Context Menu Actions

**Editor context menu** (requires text selection):

- "New Zettel from excerpt" — creates a note in the configured default folder, with the selected text as a blockquote in the body; the new note's `zettel-id` uses `nextRootId` for the target folder.

**File explorer — note (.md file)**:

- "Create derivative note" — reads the file's `zettel-id` frontmatter, calls `nextChildId(parentId, folder)`, creates a sibling file.

**File explorer — folder**:

- "New Zettel here" — calls `nextRootId(folder)` for that folder, creates a note with the next top-level ID in series.
- "Migrate notes to current scheme" — triggers the migration flow for all zettel notes in the folder (hierarchical schemes only; shows incompatibility notice for Timestamp/Sequential source notes).

## Settings

- `scheme`: `'decimal' | 'luhmann' | 'timestamp' | 'sequential' | 'custom'` (default: `'luhmann'`)
- `customRootTemplate`: string (default: `"{n}"`)
- `customChildTemplate`: string (default: `"{parent}.{n}"`)
- `defaultFolder`: vault-relative path for new notes (default: vault root)
- `templatePath`: vault-relative path to the active note template file (default: `.obsidian/plugins/zettelgarten/default-template.md`); accepts any path including hidden directories; entered as a plain text input (Obsidian's file suggester does not surface hidden directories)

Note: the `includeParentRef` boolean setting is superseded by the `{{parent-uuid}}` and `{{parent-id}}` template variables — users control whether and how parent references appear by editing their template file directly.

## Out of Scope (v1)

- **Structure notes / Maps of Content** — users can create them manually; no special plugin affordance in v1
- **Multiple note type templates** — `type: zettel` is the single static value; users may edit it manually or in a custom template
- **Mobile support** — `isDesktopOnly: true`; `vault.adapter` differences on mobile are not handled

## Initialization — Placeholder Values

The following `{{...}}` tokens need replacing across `manifest.json`, `package.json`, `doap.json`, `versions.json`, `CHANGELOG.md`, and `LICENSE`:

| Token                      | Value                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `{{PLUGIN_ID}}`            | `zettelgarten`                                                                                                               |
| `{{PLUGIN_NAME}}`          | `Zettelgarten`                                                                                                               |
| `{{PLUGIN_DESCRIPTION}}`   | `Zettelkasten note management with configurable ID schemes, derivative note creation, and automatic frontmatter generation.` |
| `{{AUTHOR_NAME}}`          | `Clinamenic`                                                                                                                 |
| `{{AUTHOR_URL}}`           | `https://github.com/Clinamenic`                                                                                              |
| `{{REPOSITORY_URL}}`       | `https://github.com/Clinamenic/obs-plugin-zettelgarten`                                                                      |
| `{{MIN_OBSIDIAN_VERSION}}` | `1.0.0`                                                                                                                      |
| `{{CREATION_DATE}}`        | today's date (`2026-04-04`)                                                                                                  |
| `{{YEAR}}`                 | `2026`                                                                                                                       |

Class renames in `src/`: `MyPlugin` → `ZettelgartenPlugin`, `MyPluginSettingTab` → `ZettelgartenSettingTab`.

After substitution: `npm install && npm run build` to verify the scaffold compiles.

## Key Obsidian APIs Used

- `this.app.vault.create(path, content)` — file creation
- `this.app.vault.getMarkdownFiles()` — scan for existing IDs
- `this.app.metadataCache.getFileCache(file).frontmatter` — read existing `zettel-id` values without parsing raw text
- `registerEvent(this.app.workspace.on('editor-menu', ...))` — editor context menu
- `registerEvent(this.app.workspace.on('file-menu', ...))` — file explorer context menu
- `crypto.randomUUID()` — UUID v4 generation (available in Obsidian's Chromium runtime); used inside `TemplateProcessor`
- `new Modal(this.app)` — title prompt dialog
