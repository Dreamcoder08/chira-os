#!/usr/bin/env bash
set -euo pipefail
repo='Dreamcoder08/chira-os'
visibility_file="$(mktemp)"
trap 'rm -f "$visibility_file"' EXIT
[[ "$(gh api user --jq .login)" == Dreamcoder08 ]] || { echo 'Expected the authorized Dreamcoder08 account.' >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit and verify local changes first.' >&2; exit 1; }
if gh repo view "$repo" --json isPrivate --jq .isPrivate > "$visibility_file"; then
  [[ "$(cat "$visibility_file")" == true ]] || { echo 'Refusing to publish to a public repository.' >&2; exit 1; }
  if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "https://github.com/$repo.git"; fi
else
  gh repo create "$repo" --private --source=. --remote=origin --description 'CHIRA OS Guardian: offline agricultural inspections, hexagonal architecture and verified security boundaries'
fi
[[ "$(git remote get-url origin)" == "https://github.com/$repo.git" ]] || { echo 'Unexpected origin; inspect it before publishing.' >&2; exit 1; }
git push -u origin HEAD:main
gh repo edit "$repo" --default-branch main --delete-branch-on-merge
gh api --method PUT "repos/$repo/vulnerability-alerts"
echo "Published private repository: https://github.com/$repo"
