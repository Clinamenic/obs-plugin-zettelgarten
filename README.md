# starter-obs-plugin

A general-purpose starter workspace for building compliant, maintainable [Obsidian](https://obsidian.md/) plugins. Modeled on the SAWA framework pattern, adapted specifically for the Obsidian plugin ecosystem.

## What is included

**Plugin scaffold**
- `manifest.json` — Obsidian plugin manifest with placeholder fields
- `package.json` — npm project with TypeScript + esbuild build toolchain
- `src/main.ts` — minimal `Plugin` class
- `src/settings.ts` — minimal `PluginSettingTab`
- `src/types.ts` — `PluginSettings` interface placeholder
- `styles.css` — CSS shell with Obsidian CSS variable guidance
- `tsconfig.json`, `esbuild.config.mjs` — TypeScript + esbuild configuration
- `versions.json` — Obsidian version compatibility map
- `.github/workflows/release.yml` — automated GitHub release on git tag push

**Workspace scaffolding** (`.workspace/`)
- `scripts/version-bump.sh` — manifest-first SemVer bump (syncs manifest.json → versions.json → package.json → doap.json)
- `scripts/doap-sync.sh` — sync doap.json metadata to package.json
- `config/version-bump.conf` — optional script overrides
- `docs/ref/obsidian-plugin-guidelines.md` — Obsidian developer policies and guidelines
- `docs/ref/reference.doap.json` — filled DOAP example

**Cursor rules** (`.cursor/rules/`)
- `001` workspace philosophy, `002` rule framework, `003` docs, `004` tools
- `005a` project initialization, `005b` version management, `005c` release and submission
- `008` style (no-emoji + Obsidian CSS conventions)
- `009` Obsidian compliance (API patterns, manifest, mobile, UI text)
- `027` planning docs

**`AGENTS.md`** — comprehensive agent orientation and workflow reference

**`doap.json`** — structured project metadata (DOAP + schema.org), Obsidian-adapted

## Getting started

1. Clone or fork this repository
2. Open in Cursor and ask the assistant to initialize the project (rule `005a`), or replace `{{PLACEHOLDER}}` values manually
3. `npm install && npm run build`
4. Develop with `npm run dev`; symlink the folder into a test vault

For releases, see `AGENTS.md` or `.cursor/rules/005b_project_update.mdc`.

## Design decisions

- **manifest.json is the version source of truth** — Obsidian reads it; the version-bump script bumps it first and syncs to all other files
- **DOAP.json for project metadata** — Obsidian-specific fields (`obsidianPluginId`, `obsidianMinVersion`, `releases[]`) track plugin identity and release history
- **Lean rule set** — only rules directly relevant to Obsidian plugin development are included
