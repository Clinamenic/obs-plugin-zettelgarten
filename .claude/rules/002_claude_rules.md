---
paths:
  - ".claude/rules/**/*.md"
---

## Claude Rules Framework

1. Core Purpose

   - Provide development guidance
   - Document conventions and patterns
   - Support tool configuration
   - Enable project-specific extensions

2. Rule Structure

   - File name: descriptive slug (e.g. `008_style.md`, `009_obsidian_plugin.md`)
   - Frontmatter: optional `paths:` list for path-scoped rules; omit frontmatter to load unconditionally
   - Content: concise markdown format

3. Loading Behavior

   - Rules without `paths:` frontmatter load at every session start (unconditional)
   - Rules with `paths:` frontmatter load only when Claude reads files matching those patterns
   - Use path-scoping for rules that are only relevant to specific file types (e.g. TypeScript compliance rules scoped to `src/**/*.ts`)

4. Best Practices
   - One topic per file; keep each rule under 150 lines
   - Rules guide, don't enforce
   - Cross-reference `.workspace/docs/` for full reference material
   - Keep content assistant-agnostic where possible; use `.claude/` only for Claude-specific concerns
