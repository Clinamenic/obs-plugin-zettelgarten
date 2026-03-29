---
paths:
  - "src/**/*.ts"
  - "manifest.json"
  - "styles.css"
---

## Obsidian Plugin Compliance

Full reference: `.workspace/docs/ref/obsidian-plugin-guidelines.md`

---

### manifest.json required fields

Every release must have these fields populated with no remaining `{{...}}` placeholders:

- `id` — unique, kebab-case, no `obsidian` prefix
- `name` — display name shown in Settings
- `version` — SemVer string matching the git tag and package.json
- `minAppVersion` — lowest compatible Obsidian version
- `description` — under 250 chars, ends with `.`, starts with an action verb, no emoji
- `author` — author name
- `isDesktopOnly` — `true` if any Node.js/Electron API is used; `false` otherwise

Remove `fundingUrl` from manifest if you do not accept financial support.

---

### General

**Use `this.app`, not the global `app`**

```typescript
// Good
this.registerEvent(this.app.vault.on("modify", handler));

// Bad — global app is for debugging only and may be removed
app.vault.on("modify", handler);
```

**Avoid unnecessary `console.log`** — the developer console should only show errors in production. Remove all debug logging before submission.

**Rename placeholder class names** — `MyPlugin` and `MyPluginSettingTab` must be renamed to reflect the actual plugin before submission.

**Organize multi-file codebases into folders** for maintainability and easier review.

---

### Mobile

**No Node.js or Electron APIs on mobile.** If your plugin uses `fs`, `crypto`, `os`, `path`, or any Electron API, set `isDesktopOnly: true` in manifest.json. These APIs crash mobile Obsidian.

**Use Web API alternatives where possible:**
- `SubtleCrypto` instead of Node.js `crypto`
- `navigator.clipboard.readText()` / `writeText()` instead of clipboard packages

**Regex lookbehind** is only safe on iOS 16.4+. Avoid it for mobile-compatible plugins, or provide a fallback using `Platform.isMobile`.

**Use `Platform.isMobile`** (not `process.platform`) for conditional mobile behavior.

---

### UI text

- **Sentence case** everywhere: "Template folder location" not "Template Folder Location"
- **Use `setHeading()`** instead of raw `<h1>` or `<h2>` elements — raw headings produce inconsistent styling:

```typescript
new Setting(containerEl).setName("Advanced").setHeading();
```

- **Avoid a top-level heading** at the start of the settings tab (no "Settings", "General", or the plugin name as a heading)
- **Avoid "settings" in section headings** — prefer "Advanced" over "Advanced settings"
- **Use correct capitalization** for proper nouns: Obsidian, Markdown, PDF, GitHub

---

### Security

**Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with user-defined or external input** — these allow arbitrary code execution:

```typescript
// Bad
el.innerHTML = `<b>${userInput}</b>`;

// Good — use the Obsidian DOM helpers
const b = el.createEl("b", { text: userInput });
```

Use `createEl()`, `createDiv()`, `createSpan()` to build DOM programmatically. Clear element contents with `el.empty()`.

---

### Resource management

**Register all listeners via lifecycle-managed methods** so they are automatically cleaned up when the plugin unloads:

```typescript
this.registerEvent(this.app.vault.on("modify", handler));
this.addCommand({ id: "...", name: "...", callback: handler });
this.registerDomEvent(el, "click", handler);
```

**Do not manually call `removeEventListener`** for listeners registered this way.

**Do not detach leaves in `onunload`** — open leaves are reinitialized at their original position when the plugin is updated.

---

### Commands

**No default hotkeys** — hotkeys conflict between plugins and override user configuration. Leave `hotkeys` unset.

**Do not include the plugin ID in the command ID** — Obsidian automatically prefixes command IDs with your plugin ID:

```typescript
this.addCommand({
  id: "open-modal",     // Obsidian makes this "my-plugin:open-modal"
  name: "Open modal",
  callback: () => { ... },
});
```

**Use the correct callback type:**
- `callback` — command runs unconditionally
- `checkCallback` — command only runs under certain conditions (return `false` when unavailable)
- `editorCallback` / `editorCheckCallback` — command requires an active Markdown editor

---

### Workspace

**Use `getActiveViewOfType()` instead of `workspace.activeLeaf`:**

```typescript
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) { ... }
```

**Use `workspace.activeEditor?.editor` to access the active editor:**

```typescript
const editor = this.app.workspace.activeEditor?.editor;
if (editor) { ... }
```

**Do not store references to custom views** — retrieve them each time via `getActiveLeavesOfType()`:

```typescript
// Bad
this.registerView(MY_VIEW_TYPE, () => (this.view = new MyView()));

// Good
this.registerView(MY_VIEW_TYPE, () => new MyView());

// Retrieve when needed
for (const leaf of this.app.workspace.getLeavesOfType(MY_VIEW_TYPE)) {
  if (leaf.view instanceof MyView) { ... }
}
```

---

### Vault

**For active file edits, use the `Editor` API** (not `Vault.modify`) to preserve cursor position, selection, and folded state.

**For background file edits, use `Vault.process`** (not `Vault.modify`) — it runs atomically to avoid conflicts with other plugins:

```typescript
await this.app.vault.process(file, (content) => content.replace("old", "new"));
```

**For frontmatter edits, use `FileManager.processFrontMatter`** — it runs atomically and produces consistent YAML:

```typescript
await this.app.fileManager.processFrontMatter(file, (fm) => {
  fm["my-key"] = "value";
});
```

**Prefer the Vault API over the Adapter API** (`app.vault` not `app.vault.adapter`) — the Vault API caches reads and serializes writes.

**Use direct path lookup instead of iterating all files:**

```typescript
// Bad
const file = this.app.vault.getFiles().find(f => f.path === path);

// Good
const file = this.app.vault.getFileByPath(path);
const folder = this.app.vault.getFolderByPath(path);
const abstract = this.app.vault.getAbstractFileByPath(path);
```

**Always use `normalizePath()` for user-defined or constructed paths:**

```typescript
import { normalizePath } from "obsidian";
const path = normalizePath(userInput + "/file.md");
```

---

### Editor extensions

When reconfiguring a registered editor extension, mutate the **same array reference** and call `updateOptions()`:

```typescript
private editorExtension: Extension[] = [];

onload() {
  this.registerEditorExtension(this.editorExtension);
}

updateExtension() {
  this.editorExtension.length = 0;             // clear, same reference
  this.editorExtension.push(newExtension());   // repopulate
  this.app.workspace.updateOptions();          // flush to all editors
}
```

---

### Styling

**No hardcoded inline styles** — use CSS classes so themes and snippets can override:

```typescript
// Bad
el.style.color = "white";

// Good
el.addClass("my-plugin-warning");
```

**Use Obsidian CSS variables** in `styles.css`:

```css
.my-plugin-warning {
  color: var(--text-error);
  background-color: var(--background-modifier-error);
}
```

**Prefix every CSS class with the plugin id** to avoid collisions with core Obsidian and other plugins.

---

### TypeScript

- **`const` and `let` only** — never `var`
- **`async`/`await` over Promise chains** for readability:

```typescript
// Good
async function fetchData(): Promise<string | null> {
  try {
    const res = await requestUrl("https://example.com");
    return res.text;
  } catch (e) {
    return null;
  }
}
```
