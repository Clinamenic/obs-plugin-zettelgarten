# Quick Start

Human-readable guide for getting started with the Obsidian plugin starter workspace. Agents should refer to `AGENTS.md` instead.

## 1. Initialize a new plugin

Open the project in Cursor and ask the assistant to initialize the project. It will collect your plugin information and replace all placeholders in `manifest.json`, `doap.json`, `package.json`, and related files.

Alternatively, find and replace `{{PLACEHOLDER}}` values manually:

| Placeholder | Description |
|-------------|-------------|
| `{{PLUGIN_ID}}` | Unique kebab-case id (e.g. `my-plugin`) |
| `{{PLUGIN_NAME}}` | Display name (e.g. `My Plugin`) |
| `{{PLUGIN_DESCRIPTION}}` | One-sentence description |
| `{{MIN_OBSIDIAN_VERSION}}` | e.g. `1.0.0` |
| `{{AUTHOR_NAME}}` | Your name or handle |
| `{{AUTHOR_URL}}` | Your website or GitHub profile |
| `{{REPOSITORY_URL}}` | GitHub repository URL |
| `{{CREATION_DATE}}` | Today's date in YYYY-MM-DD format |

## 2. Install dependencies and build

```bash
npm install
npm run build
```

## 3. Develop

```bash
npm run dev    # watch mode — rebuilds on file changes
```

Symlink the project directory into a test vault:

```bash
ln -s /path/to/project /path/to/vault/.obsidian/plugins/{{PLUGIN_ID}}
```

Enable the plugin in Obsidian: Settings → Community plugins → turn on the plugin.

## 4. Release

Version bump (updates manifest.json, versions.json, package.json, doap.json):

```bash
.workspace/scripts/version-bump.sh patch   # bug fix
.workspace/scripts/version-bump.sh minor   # new feature
.workspace/scripts/version-bump.sh major   # breaking change
```

Then follow the two-commit release flow (see `.cursor/rules/005b_project_update.mdc` for Cursor, or `.claude/rules/005b_project_update.md` for Claude Code) and push a tag:

```bash
git tag v0.2.0
git push && git push --tags
```

GitHub Actions will build the plugin and create a draft release. Review and publish it on GitHub.

## 5. Optional: DOAP sync

After editing `doap.json` metadata, sync to `package.json`:

```bash
.workspace/scripts/doap-sync.sh
```

## Workspace structure

```
.workspace/
  scripts/
    version-bump.sh    # SemVer bump (manifest-first)
    doap-sync.sh       # Sync doap.json to package.json
  config/
    version-bump.conf  # Optional script overrides
  docs/
    ref/               # Reference docs (Obsidian guidelines, DOAP example)
    arch/              # Architecture docs (updated per release)
    temp/              # Temporary planning documents
```
