#!/usr/bin/env bash
set -euo pipefail
scanner='aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c'
task_root="$(pwd -P)"
mkdir -p .local/security
mounts=(--mount "type=bind,src=$task_root,dst=/repo,readonly" --volume chira-trivy-cache:/root/.cache/trivy)
trust=()
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then
  mounts+=(--mount "type=bind,src=$CODEX_PROXY_CERT,dst=/run/proxy-ca.pem,readonly")
  trust+=(-e SSL_CERT_FILE=/run/proxy-ca.pem)
fi
if [[ "${1:-fs}" == image || "${1:-fs}" == database ]]; then
  image='chira-os:local'
  if [[ "${1:-fs}" == database ]]; then image="$(docker compose config --images)"; fi
  docker image save "$image" -o .local/security/image.tar
  docker run --rm "${mounts[@]}" "${trust[@]}" "$scanner" image --input /repo/.local/security/image.tar --no-progress --scanners vuln --severity HIGH,CRITICAL --exit-code 1
else
  docker run --rm "${mounts[@]}" "${trust[@]}" "$scanner" fs --no-progress --scanners vuln,secret --include-dev-deps --severity HIGH,CRITICAL --exit-code 1 --skip-dirs /repo/.local --skip-dirs /repo/node_modules --skip-dirs /repo/.git --skip-dirs /repo/apps/web/dist /repo
fi
