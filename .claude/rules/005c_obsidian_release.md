---
paths:
  - ".github/workflows/**"
  - "manifest.json"
---

## GitHub Release Workflow

Releasing is triggered by pushing a git tag. The workflow in `.github/workflows/release.yml` automatically:
1. Installs dependencies and runs `npm run build`
2. Creates a **draft** GitHub release with `main.js`, `manifest.json`, `styles.css` as attachments

### Steps (after Commit B from rule 005b)

```sh
git tag vX.Y.Z
git push && git push --tags
```

Then on GitHub:
1. Go to the repository → Releases → open the draft
2. Add release notes (can be taken from CHANGELOG.md)
3. Publish the release

### Prerequisites (one-time setup)

- GitHub repository Settings → Actions → General → Workflow permissions → Read and write permissions

### BRAT Beta Testing

To distribute a pre-release for testing via [BRAT](https://github.com/TfTHacker/obsidian42-brat):
1. Create the release with the `Pre-release` checkbox ticked on GitHub
2. Instruct testers to add the repository URL in BRAT settings
3. BRAT auto-updates when new pre-releases are published
4. Pre-releases do NOT appear to regular users in Obsidian's plugin browser

### Obsidian Community Plugin Submission (first release only)

Before submitting, ensure all items below are satisfied:

**Required files**
- [ ] `README.md` — purpose and usage instructions
- [ ] `LICENSE` — MIT or compatible open-source license (no placeholders remaining)
- [ ] `manifest.json` — valid with all required fields; no `{{...}}` placeholders

**Compliance checklist** (see `.workspace/docs/ref/obsidian-plugin-guidelines.md`)
- [ ] Plugin id is unique, kebab-case, no `obsidian` prefix
- [ ] Description is under 250 characters, ends with a period, starts with an action verb
- [ ] `isDesktopOnly: true` if Node.js/Electron APIs (`fs`, `crypto`, etc.) are used
- [ ] No hardcoded credentials, secrets, or user-specific vault paths
- [ ] No use of global `app` — always `this.app`
- [ ] No hardcoded inline styles — CSS classes with Obsidian CSS variables only
- [ ] No `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with user input
- [ ] Resource cleanup: events/commands/DOM listeners registered via `registerEvent`, `addCommand`, `registerDomEvent`
- [ ] No default hotkeys set on commands
- [ ] Settings tab uses `PluginSettingTab`; headings use `setHeading()`; sentence case throughout
- [ ] Placeholder class names (`MyPlugin`, `MyPluginSettingTab`) replaced with plugin-specific names
- [ ] All sample/placeholder code removed from source files

**Submission**
1. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
2. Add an entry to `community-plugins.json` with `id`, `name`, `author`, `description`, `repo`
3. Open a pull request; Obsidian team reviews and merges

After the initial listing, subsequent updates to released versions are distributed automatically via GitHub releases.
