# Changelog

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
