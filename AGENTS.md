# Agent Instructions

This document provides comprehensive guidance for AI coding assistants working on an Obsidian plugin project built from the starter-obs-plugin template.

## Table of Contents

1. [Workspace Orientation](#workspace-orientation)
2. [Project Initialization](#project-initialization)
3. [Development Workflow](#development-workflow)
4. [Version Management](#version-management)
5. [Releasing](#releasing)
6. [Session Protocols](#session-protocols)

## Workspace Orientation

### Directory Structure

- **Project Space** (root): Plugin source code, manifest, package.json, build config
- **`.workspace/`**: Assistant-agnostic shared resources (scripts, configs, docs)
- **`.cursor/`**: Cursor-specific rules and guidance
- **`.claude/`**: Claude-specific rules and guidance (if present)

### Key Files

| File | Purpose |
|------|---------|
| `manifest.json` | **Primary version source.** Obsidian reads this. |
| `versions.json` | Maps plugin versions to minimum Obsidian versions |
| `package.json` | npm metadata (version synced from manifest) |
| `doap.json` | Structured project metadata (version synced from manifest) |
| `CHANGELOG.md` | Human-readable release notes |
| `AGENTS.md` | This file |

### Conventions

**Conventional Commits → SemVer:**

- `fix:` → PATCH (0.0.x)
- `feat:` → MINOR (0.x.0)
- `BREAKING CHANGE` or `!` → MAJOR (x.0.0)
- `docs/style/refactor/test/chore` → PATCH

**Git Tags:** Tag releases as `vX.Y.Z`. Pushing a tag triggers GitHub Actions to build and draft a release.

**Version source:** `manifest.json` is primary. The version-bump script keeps all other files in sync.

### Shared Scripts

- `.workspace/scripts/version-bump.sh [patch|minor|major]` — bump version (manifest-first)
- `.workspace/scripts/doap-sync.sh [--dry-run]` — sync doap.json metadata to package.json

### Orientation Steps (start of session)

1. Read this file completely
2. Scan `.workspace/scripts/` and `.workspace/config/` for available tools
3. Review `.cursor/rules/` (Cursor) or `.claude/rules/` (Claude Code) for project-specific guidance
4. Check `manifest.json` for the current plugin id, version, and minAppVersion
5. Review `CHANGELOG.md` and recent tags for release context

## Project Initialization

When starting a new plugin from this template, follow rule `005a_project_initialization.mdc`:

1. Collect plugin information from the user (plugin id, name, description, minAppVersion, author, repository URL)
2. Replace all `{{PLACEHOLDER}}` values in manifest.json, doap.json, package.json, versions.json, CHANGELOG.md
3. Write README.md with project-specific content
4. Run `npm install` and `npm run build` to verify the build
5. Run `.workspace/scripts/doap-sync.sh` to confirm sync
6. Initialize git repository; create initial commit
7. Push to GitHub; enable read/write Actions permissions

## Development Workflow

### Building

```bash
npm run dev      # watch mode for development
npm run build    # production build (tsc check + esbuild)
```

### Testing in Obsidian

Symlink the plugin directory into a test vault:

```bash
ln -s /path/to/plugin /path/to/vault/.obsidian/plugins/{{PLUGIN_ID}}
```

Then enable the plugin in Obsidian Settings → Community plugins.

### Code Quality

- Run `npm run build` before committing to catch TypeScript errors
- Use Obsidian CSS variables in styles.css (never hardcode colors or spacing)
- Prefix all CSS classes with the plugin id
- Use lifecycle-managed event registration (`this.registerEvent`, `this.addCommand`)

## Version Management

Follow rule `005b_project_update.mdc` when preparing a release:

1. Analyze commits since last tag: `git log --oneline vX.Y.Z..HEAD`
2. Determine bump type (MAJOR/MINOR/PATCH)
3. Run `.workspace/scripts/version-bump.sh [patch|minor|major]`
4. Update `.workspace/docs/arch/` if architecture changed
5. Run `.workspace/scripts/doap-sync.sh`
6. Commit A: `git add . && git commit -m "chore(release): bump version to X.Y.Z"`
7. Capture metadata: `BUMP_SHA=$(git rev-parse --short HEAD)` and `BUMP_DATE=$(git show -s --format=%cI HEAD)`
8. Update CHANGELOG.md referencing BUMP_SHA
9. Commit B: `git add CHANGELOG.md && git commit -m "docs(changelog): release X.Y.Z (refs $BUMP_SHA)"`
10. Tag and push: `git tag vX.Y.Z && git push && git push --tags`

## Releasing

See rule `005c_obsidian_release.mdc`:

- Pushing a tag triggers `.github/workflows/release.yml`, which builds the plugin and creates a draft GitHub release with `main.js`, `manifest.json`, and `styles.css`
- Review and publish the draft release on GitHub
- For BRAT beta testing: publish as a Pre-release
- For first-time community plugin submission: add an entry to `obsidianmd/obsidian-releases` community-plugins.json

## Session Protocols

### Session Ending Protocol

1. Note any remaining work, bugs, or follow-up tasks in a handoff comment or temp planning doc
2. Verify clean git state: `git status` shows no uncommitted changes
3. Provide a prompt for the next session with relevant context

### Best Practices

- Use `.workspace/` for shared, assistant-agnostic assets
- Keep assistant-specific rules in `.cursor/` or `.claude/`
- Never hardcode secrets or vault paths in plugin source
- Always run `npm run build` before tagging a release
