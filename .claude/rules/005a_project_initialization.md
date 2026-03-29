---
paths:
  - "manifest.json"
  - "doap.json"
  - "package.json"
  - "CHANGELOG.md"
  - "README.md"
  - "LICENSE"
---

## Project Initialization

### 1. Collect Plugin Information

Ask the user for the following:

#### Required
- `{{PLUGIN_ID}}` — Obsidian plugin id, kebab-case, globally unique, no `obsidian` prefix (e.g. `my-plugin`)
- `{{PLUGIN_NAME}}` — Display name shown in Obsidian Settings (e.g. `My Plugin`)
- `{{PLUGIN_DESCRIPTION}}` — One-sentence description (see constraints below)
- `{{MIN_OBSIDIAN_VERSION}}` — Minimum Obsidian version required (e.g. `1.0.0`)
- `{{AUTHOR_NAME}}` — Author's full name or handle
- `{{AUTHOR_URL}}` — Author's website or GitHub profile URL
- `{{REPOSITORY_URL}}` — GitHub repository URL

#### Optional
- `{{KEYWORD_1}}`, `{{KEYWORD_2}}` — Relevant keywords for doap.json
- `{{FEATURE_1}}`, `{{FEATURE_2}}` — Key features for doap.json

#### Description constraints (Obsidian community plugin requirements)
- Maximum 250 characters
- Must end with a period `.`
- Start with an action verb (e.g. "Translates...", "Generates...", "Syncs...")
- Do not begin with "This is a plugin"
- Avoid emoji or special characters
- Use correct capitalization for proper nouns (Obsidian, Markdown, PDF)

### 2. Set Default Values

For fields not provided by the user:
- `{{CREATION_DATE}}` — today's date in ISO 8601 format (YYYY-MM-DD)
- `{{YEAR}}` — current four-digit year (for LICENSE)
- `{{ISSUE_TRACKER_URL}}` — `{{REPOSITORY_URL}}/issues`
- Releases, relatedProjects — leave template placeholders intact for later

### 3. Replacement Process

1. Read and update `manifest.json` — replace all `{{...}}` fields
2. Read and update `doap.json` — replace all `{{...}}` fields
3. Read and update `package.json` — replace all `{{...}}` fields
4. Update `versions.json` — replace `{{MIN_OBSIDIAN_VERSION}}` in the `"0.1.0"` entry
5. Update `CHANGELOG.md` — replace `{{CREATION_DATE}}`
6. Update `LICENSE` — replace `{{YEAR}}` and `{{AUTHOR_NAME}}`
7. Write `README.md` with project-specific content (plugin name, description, usage, development instructions)
8. Rename placeholder class names in source files: `MyPlugin` → `<PluginName>Plugin`, `MyPluginSettingTab` → `<PluginName>SettingTab`

### 4. Validation Checklist

- All `{{...}}` placeholders replaced in manifest.json, doap.json, package.json, versions.json, LICENSE
- JSON structure is valid in all files
- `manifest.json` `id` matches `doap.json` `obsidianPluginId`
- `manifest.json` `version` matches `package.json` `version` and `doap.json` `version`
- Plugin `id` is kebab-case with no spaces and no `obsidian` prefix
- Description is under 250 characters, ends with a period, starts with an action verb
- Source class names no longer use `MyPlugin` / `MyPluginSettingTab` placeholders

### 5. Post-Initialization Steps

1. Run `npm install` to install dependencies
2. Run `npm run build` to verify the build succeeds
3. Run `.workspace/scripts/doap-sync.sh` to confirm all files are in sync
4. Initialize git repository if not already done; create initial commit
5. Set up GitHub repository and push
6. Enable read/write Actions permissions in GitHub → Settings → Actions → General

### 6. Next Steps After Initialization

- **Development**: `npm run dev` for watch mode; symlink the plugin folder into a test vault
- **Version management**: use rule 005b when preparing a release
- **Release**: use rule 005c for GitHub release + optional submission
