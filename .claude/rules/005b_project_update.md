## Integrated Git + SemVer Strategy

1. Commit-to-Version Mapping (per Conventional Commits)

- fix: → PATCH (0.0.X) - Bug fixes
- feat: → MINOR (0.X.0) - New features
- BREAKING CHANGE or !: → MAJOR (X.0.0) - Breaking changes
- docs/style/refactor/test/chore: → PATCH - Non-breaking changes

2. Version Source of Truth

- `manifest.json` is primary (Obsidian reads it; it also holds `minAppVersion`)
- `version-bump.sh` updates: manifest.json → versions.json → package.json → doap.json
- Never edit versions manually; always use the script

3. Complete Process (single-source order of operations)

- Analyze commits since last version tag → determine bump type
- Run `.workspace/scripts/version-bump.sh [patch|minor|major]`
- Update architecture docs in `.workspace/docs/arch/` for the release
- Run `.workspace/scripts/doap-sync.sh` to verify sync
- Optionally run `npm install` to refresh `package-lock.json`
- Conventional commit for bump + docs changes (Commit A)
- Capture Commit A metadata; update `CHANGELOG.md` referencing it (Commit B)
- Tag release at Commit B → push with tags → GitHub Actions creates draft release

4. Implementation Steps for AI Assistant (execute in this order)

   a) Change Analysis: `git status`, `git diff --stat`, examine key files
   b) Impact Assessment: categorize changes (breaking/feature/fix/maintenance)
   c) Version Decision: apply highest impact rule (MAJOR > MINOR > PATCH)
   d) Version Management: `.workspace/scripts/version-bump.sh [patch|minor|major]`
   e) Architecture Docs: update `.workspace/docs/arch/*.md` for the new version
   f) File Sync: `.workspace/scripts/doap-sync.sh`
   g) Optional: `npm install` (update package-lock.json)
   h) Commit A: conventional commit for bump + docs updates
   i) Capture metadata: `BUMP_SHA=$(git rev-parse --short HEAD)` and `BUMP_DATE=$(git show -s --format=%cI HEAD)`
   j) CHANGELOG: update CHANGELOG.md referencing `BUMP_SHA` and using `BUMP_DATE`
   k) Commit B + Release: commit changelog → `git tag vX.Y.Z` → push with tags

## Commit Process

Message format (Conventional Commits): `type(scope): description`

Types: feat, fix, docs, style, refactor, test, chore

Example commands:

```sh
# Commit A: bump + arch docs
git add .
git commit -m "chore(release): bump version to X.Y.Z"

# Capture metadata
BUMP_SHA=$(git rev-parse --short HEAD)
BUMP_DATE=$(git show -s --format=%cI HEAD)

# Commit B: changelog
git add CHANGELOG.md
git commit -m "docs(changelog): release X.Y.Z (refs $BUMP_SHA)"

# Tag and push — GitHub Actions builds and creates a draft release
git tag vX.Y.Z
git push && git push --tags
```

## CHANGELOG.md Format

One section per release, Keep a Changelog style:

```
## X.Y.Z - YYYY-MM-DD

Commit: <BUMP_SHA> (<BUMP_DATE>)

### Added
- feat(plugin): describe new feature

### Fixed
- fix(settings): describe bug fix
```

Include only subsections that apply: Added, Changed, Fixed, Removed, Security, Breaking.

## Architecture Docs Update

Update `.workspace/docs/arch/*.md` to reflect notable changes in the release:
- Add a top section for `X.Y.Z - YYYY-MM-DD` summarizing impacted components
- Capture changes in data flow, vault interaction, settings schema, or APIs
- Keep docs assistant-agnostic
