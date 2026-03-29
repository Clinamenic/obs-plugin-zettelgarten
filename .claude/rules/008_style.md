## Emoji Usage

**No emojis are permitted anywhere in the project codebase.** This restriction applies without exception to:

- Source code files (TypeScript, JavaScript)
- Stylesheets (CSS)
- Configuration files (JSON, YAML)
- Documentation files (Markdown, text files)
- Comments in any file type
- String literals and content
- Any other project files

Maintain clean, professional code throughout the entire project free of emoji characters.

## Obsidian CSS Conventions

**Use Obsidian CSS variables** for all colours, spacing, and typography so the plugin respects the user's chosen theme:

- Colors: `var(--text-normal)`, `var(--text-muted)`, `var(--text-accent)`, `var(--background-primary)`, `var(--background-secondary)`, `var(--background-modifier-border)`
- Spacing: `var(--size-4-1)` through `var(--size-4-8)` (4px base grid)
- Typography: `var(--font-text-size)`, `var(--font-ui-small)`, `var(--font-monospace)`

**Do not import external CSS frameworks** (Tailwind, Bootstrap, etc.); they conflict with Obsidian themes and bloat the bundle.

**Prefix all CSS classes with the plugin id** to avoid collisions with core Obsidian and other plugins:

```css
/* Good */
.my-plugin-modal { ... }
.my-plugin-tab { ... }

/* Bad — too generic, will conflict */
.modal-header { ... }
.tab { ... }
```
