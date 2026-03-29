#!/bin/bash

# DOAP Synchronization Script
#
# Reads doap.json and syncs name, description, version, author, repository,
# and keywords into package.json.
#
# Usage: .workspace/scripts/doap-sync.sh [--dry-run]
#
# Note: manifest.json is NOT modified by this script. The version-bump.sh
# script keeps manifest.json and doap.json in sync during release.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DOAP_JSON_PATH="$REPO_ROOT/doap.json"
PACKAGE_JSON_PATH="$REPO_ROOT/package.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [[ ! -f "$DOAP_JSON_PATH" ]]; then
  echo -e "${RED}Error: doap.json not found at $DOAP_JSON_PATH${NC}"
  exit 1
fi

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}Dry-run mode: no files will be modified${NC}"
fi

extract_metadata() {
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$DOAP_JSON_PATH', 'utf8'));
    console.log('NAME=' + (d.name || ''));
    console.log('VERSION=' + (d.version || ''));
    console.log('DESCRIPTION=' + (d.description || ''));
    console.log('AUTHOR_NAME=' + (d.author?.name || ''));
    console.log('REPOSITORY_URL=' + (d.repository?.url || ''));
    console.log('KEYWORDS=' + (d.keywords?.join(', ') || ''));
  "
}

sync_package_json() {
  echo -e "${BLUE}Syncing package.json...${NC}"
  if [[ ! -f "$PACKAGE_JSON_PATH" ]]; then
    echo -e "${YELLOW}Warning: package.json not found, skipping${NC}"
    return
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}Would update package.json:${NC}"
    echo "  name: $NAME"
    echo "  version: $VERSION"
    echo "  description: $DESCRIPTION"
    echo "  author: $AUTHOR_NAME"
    echo "  repository: $REPOSITORY_URL"
    echo "  keywords: $KEYWORDS"
    return
  fi
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON_PATH', 'utf8'));
    pkg.name = '$NAME';
    pkg.version = '$VERSION';
    pkg.description = '$DESCRIPTION';
    if ('$AUTHOR_NAME') pkg.author = '$AUTHOR_NAME';
    if ('$REPOSITORY_URL') pkg.repository = { type: 'git', url: '$REPOSITORY_URL' };
    if ('$KEYWORDS') pkg.keywords = '$KEYWORDS'.split(', ').filter(k => k.trim());
    fs.writeFileSync('$PACKAGE_JSON_PATH', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo -e "${GREEN}Updated package.json${NC}"
}

validate_sync() {
  echo -e "${BLUE}Validating sync...${NC}"
  if [[ -f "$PACKAGE_JSON_PATH" ]]; then
    local pkg_version
    pkg_version=$(node -p "require('$PACKAGE_JSON_PATH').version" 2>/dev/null || echo "")
    if [[ "$pkg_version" != "$VERSION" ]]; then
      echo -e "${RED}Error: Version mismatch — package.json: $pkg_version, doap.json: $VERSION${NC}"
      exit 1
    fi
  fi
  echo -e "${GREEN}Validation passed${NC}"
}

main() {
  echo -e "${BLUE}DOAP Synchronization${NC}"
  echo -e "${BLUE}====================${NC}"

  echo -e "${BLUE}Reading doap.json...${NC}"
  eval "$(extract_metadata)"

  echo "  Name:       $NAME"
  echo "  Version:    $VERSION"
  echo "  Author:     $AUTHOR_NAME"
  echo "  Repository: $REPOSITORY_URL"
  echo "  Keywords:   $KEYWORDS"
  echo ""

  sync_package_json

  if [[ "$DRY_RUN" != "true" ]]; then
    validate_sync
    echo -e "${GREEN}Synchronization complete.${NC}"
  fi
}

main "$@"
