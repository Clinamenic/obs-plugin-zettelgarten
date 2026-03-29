#!/bin/bash

# Obsidian Plugin Version Bump Script
#
# Primary source: manifest.json (Obsidian reads this for the plugin version)
# Syncs to: versions.json, package.json, doap.json
#
# Usage: .workspace/scripts/version-bump.sh [patch|minor|major]
#
# Customization (no need to edit this file):
#   .workspace/config/version-bump.conf  — override any variable below
#   .workspace/scripts/version-bump.pre.sh  — runs before bump (args: VERSION_TYPE CURRENT_VERSION)
#   .workspace/scripts/version-bump.post.sh — runs after bump (args: VERSION_TYPE NEW_VERSION)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load optional config overrides
CONFIG_FILE="$REPO_ROOT/.workspace/config/version-bump.conf"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck source=/dev/null
  . "$CONFIG_FILE"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Defaults (can be overridden via config)
REQUIRE_CLEAN_TREE=${REQUIRE_CLEAN_TREE:-false}
MANIFEST_PATH=${MANIFEST_PATH:-"$REPO_ROOT/manifest.json"}
PACKAGE_JSON_PATH=${PACKAGE_JSON_PATH:-"$REPO_ROOT/package.json"}
VERSIONS_JSON_PATH=${VERSIONS_JSON_PATH:-"$REPO_ROOT/versions.json"}
DOAP_JSON_PATH=${DOAP_JSON_PATH:-"$REPO_ROOT/doap.json"}
PRE_HOOK=${PRE_HOOK:-"$REPO_ROOT/.workspace/scripts/version-bump.pre.sh"}
POST_HOOK=${POST_HOOK:-"$REPO_ROOT/.workspace/scripts/version-bump.post.sh"}

show_usage() {
  echo "Usage: .workspace/scripts/version-bump.sh [patch|minor|major]"
  echo ""
  echo "  patch   Increment patch version (x.y.Z) - for bug fixes"
  echo "  minor   Increment minor version (x.Y.z) - for new features"
  echo "  major   Increment major version (X.y.z) - for breaking changes"
}

if [ $# -eq 0 ]; then
  echo -e "${RED}Error: No version type specified${NC}"
  show_usage
  exit 1
fi

VERSION_TYPE=$1

if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  echo -e "${RED}Error: Invalid version type '$VERSION_TYPE'${NC}"
  show_usage
  exit 1
fi

cd "$REPO_ROOT"

if [ "$REQUIRE_CLEAN_TREE" = true ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo -e "${RED}Error: Working tree is not clean. Commit or stash changes first.${NC}"
    exit 1
  fi
fi

# Require manifest.json
if [ ! -f "$MANIFEST_PATH" ]; then
  echo -e "${RED}Error: manifest.json not found at $MANIFEST_PATH${NC}"
  exit 1
fi

# Read current version and minAppVersion from manifest.json (primary source)
CURRENT_VERSION=$(node -p "require('$MANIFEST_PATH').version")
MIN_APP_VERSION=$(node -p "require('$MANIFEST_PATH').minAppVersion")
echo -e "${YELLOW}Current version (manifest.json): $CURRENT_VERSION${NC}"

# Run pre-hook if present
if [ -f "$PRE_HOOK" ]; then
  echo -e "${YELLOW}Running pre-hook...${NC}"
  bash "$PRE_HOOK" "$VERSION_TYPE" "$CURRENT_VERSION"
fi

# Compute new version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$VERSION_TYPE" in
  major) NEW_MAJOR=$((MAJOR + 1)); NEW_MINOR=0; NEW_PATCH=0 ;;
  minor) NEW_MAJOR=$MAJOR; NEW_MINOR=$((MINOR + 1)); NEW_PATCH=0 ;;
  patch) NEW_MAJOR=$MAJOR; NEW_MINOR=$MINOR; NEW_PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"

echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# 1. Update manifest.json
echo -e "${YELLOW}Updating manifest.json...${NC}"
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('$MANIFEST_PATH', 'utf8'));
  data.version = '$NEW_VERSION';
  fs.writeFileSync('$MANIFEST_PATH', JSON.stringify(data, null, 2) + '\n');
"

# 2. Update versions.json (add new entry mapping version -> minAppVersion)
echo -e "${YELLOW}Updating versions.json...${NC}"
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('$VERSIONS_JSON_PATH', 'utf8'));
  data['$NEW_VERSION'] = '$MIN_APP_VERSION';
  fs.writeFileSync('$VERSIONS_JSON_PATH', JSON.stringify(data, null, 2) + '\n');
"

# 3. Update package.json
echo -e "${YELLOW}Updating package.json...${NC}"
npm version "$NEW_VERSION" --no-git-tag-version --prefix "$REPO_ROOT" > /dev/null

# 4. Update doap.json if present
if [ -f "$DOAP_JSON_PATH" ]; then
  echo -e "${YELLOW}Updating doap.json...${NC}"
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('$DOAP_JSON_PATH', 'utf8'));
    data.version = '$NEW_VERSION';
    data.dateModified = new Date().toISOString().split('T')[0];
    fs.writeFileSync('$DOAP_JSON_PATH', JSON.stringify(data, null, 4) + '\n');
  "
fi

# Run post-hook if present
if [ -f "$POST_HOOK" ]; then
  echo -e "${YELLOW}Running post-hook...${NC}"
  bash "$POST_HOOK" "$VERSION_TYPE" "$NEW_VERSION"
fi

echo -e "${GREEN}Version bump complete: $CURRENT_VERSION -> $NEW_VERSION${NC}"
echo ""
echo "Files updated:"
echo "  - manifest.json"
echo "  - versions.json"
echo "  - package.json"
[ -f "$DOAP_JSON_PATH" ] && echo "  - doap.json"
echo ""
echo "Suggested next steps:"
echo "1. Update architecture docs in .workspace/docs/arch/ if applicable"
echo "2. Run .workspace/scripts/doap-sync.sh to sync README"
echo "3. git add ."
echo "4. git commit -m \"chore(release): bump version to $NEW_VERSION\""
echo "   (capture: BUMP_SHA=\$(git rev-parse --short HEAD))"
echo "5. Update CHANGELOG.md for v$NEW_VERSION, referencing BUMP_SHA"
echo "6. git add CHANGELOG.md && git commit -m \"docs(changelog): release $NEW_VERSION\""
echo "7. git tag v$NEW_VERSION && git push && git push --tags"
