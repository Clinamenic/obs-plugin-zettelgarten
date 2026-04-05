# Changelog

## 0.4.1 - 2026-04-05

### Changed

- **Luhmann IDs:** Sibling letters under a numeric parent now continue past `z` with multi-letter sequences (`1aa`, `1ab`, …, spreadsheet-style). Sibling numbers under a letter parent already supported arbitrary length (`1a10`, `1a11`, …). Segment parsing uses full runs of letters or digits so IDs stay unambiguous.

## 0.4.0 - 2026-04-05

### Breaking

- **ID schemes:** Only **Luhmann** alphanumeric folgezettel (`1`, `1a`, `1a1`, …) remains. Decimal, timestamp, sequential, and custom template schemes are removed.
- **Settings:** `scheme`, `customRootTemplate`, and `customChildTemplate` are removed from saved settings (legacy keys are stripped on load).
- **Migration / scheme conversion:** Folder command **Migrate notes to current scheme**, vault-wide ID rename migration, and all related APIs (`migration.ts`, `computeMigrationEntries`, `executeMigration`, etc.) are removed.

### Changed

- **Apply current settings to existing notes** now **only** rebuilds frontmatter from the note template for matching notes (zettel-id + type). No file renames or zettel-id remapping.

## 0.3.1 - 2026-04-05

### Fixed

- **Naming-scheme migration (bulk):** nested IDs now stage using each parent's **new** id in the target scheme (e.g. Luhmann `1a1` to decimal `1.1.1`), not the old parent string (which produced incorrect staging such as `1a.1`).

### Changed

- **Apply current settings to existing notes:** one summary notice after the run instead of separate migration and frontmatter notices.

## 0.3.0 - 2026-04-05

### Added

- **Apply current settings to existing notes** (Settings, bottom): unified vault sync in two steps: (1) hierarchical naming-scheme migration (rename files and update `zettel-id`) when applicable, same logic as folder migration but vault-wide; (2) rebuild frontmatter for notes with a `zettel-id` and a `type` matching the note template, preserving existing field values where keys remain enabled and removing keys for disabled optional fields. (Superseded in 0.4.0: frontmatter-only; see 0.4.0 breaking changes.)

## 0.2.0 - 2026-04-05

### Added

- **Note template** is configured entirely in **Settings**: fixed fields (`uuid`, `zettel-id`, `parent-uuid`), a required literal `type`, and toggleable optional fields (`title`, `date`, `timestamp-iso`, `references`, `tags`, `parent-id`) with value templates using allowlisted `{{...}}` variables.
- Live **validation** and a **YAML preview** (sample values) in the template section.

### Removed

- **Template file path** and reading frontmatter from an external Markdown template file. Users who used a custom template file should reproduce those fields in the new settings editor.

### Changed

- New notes always use the built-in template pipeline from settings; the plugin no longer writes `default-template.md` under the plugin folder on load.

## 0.1.6 - 2026-04-05

### Added

- Optional **Sync filename with title** (enabled by default in settings): when you edit the `title` property, the note renames to `{zettel-id}.md` or `{zettel-id} {title}.md` after a short delay. Applies to all ID schemes. Only affects notes whose basename already matches the plugin pattern (`{zettel-id}` only, `{zettel-id} …` with a space, or legacy `{zettel-id} - …`). Obsidian updates internal links on rename.

## 0.1.5 - 2026-04-05 (refs 5075d3b)

### Fixed

- Ribbon icon now renders reliably by injecting the zeta glyph directly into the ribbon element's DOM rather than via `addIcon` SVG (which did not display in Obsidian's icon renderer)

## 0.1.4 - 2026-04-05

### Added

- Ribbon icon (lowercase zeta ζ) in the left sidebar that opens the Zettelgarten settings tab directly

## 0.1.3 - 2026-04-05

### Changed

- Renamed `created` frontmatter field to `timestamp-iso` to reflect the ISO 8601 format explicitly

### Fixed

- `parent-uuid` now populates correctly on excerpt/highlight notes (previously only derivative notes set this field)

## 0.1.2 - 2026-04-04

### Fixed

- `date` frontmatter field now uses ISO format `YYYY-MM-DD` so Obsidian's Properties panel parses it correctly as a date (was `MM/DD/YYYY`)
- Default template is refreshed on every plugin load so existing installs receive the corrected format automatically

## 0.1.1 - 2026-04-04 (refs 1a01639)

### Changed

- Remove title prompt modal on note creation; notes open immediately with a blank `title:` field and cursor in the content area

## 0.1.0 - 2026-04-04

### Added

- Initial release
