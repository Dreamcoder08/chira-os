# Implementation record

Plan: docs/superpowers/plans/2026-10-23-guardian.md

- Workspace: new repository on feat/guardian-foundation; no existing checkout to isolate.
- Pre-flight: shared API schemas will generate the web client; domain ports are consumed by PostgreSQL adapters and HTTP routes.
- Decision: use a feature branch in the newly created repository; a second empty worktree would provide no additional isolation.
- Dependency baseline: registry metadata checked on 2026-10-23; versions must also pass advisory analysis after lockfile generation.
- Design refinement: local file storage replaces archived MinIO; S3 stays behind a storage port and is not provisioned.

## Verification and review

- Domain RED→GREEN: stale writes, authorship, evidence lifecycle, biosecurity and CSV safety.
- Real PostgreSQL RED→GREEN: tenant membership, forced RLS with a reused connection, CSRF,
  idempotent retries/body binding, private recoded photographs, reviews, jobs and session revocation.
- Browser RED→GREEN: offline draft/photo capture, reopening, synchronization, human review and local deletion.
- Independent review identified five issues; all received reproducing regression tests:
  cache/session mismatch, absent-row concurrency, orphan/truncated photo retries, durable offline
  logout and trusted outbox binding. Fixes and limitations are recorded in docs/security-review.md.
- Backup integrity test observed corruption rejection; real dump/photographs restored in a temporary database.
- Initial container scan reported high/critical OS/tooling vulnerabilities. Runtime changed to
  pinned distroless Node 24 Debian 13 without adding scanner exclusions; subsequent image scan passed.
- Both Archify diagrams passed validation, delivery, provenance and Chromium checks. The default
  discovered browser rejected file navigation; explicitly selecting the installed Playwright Chromium
  through Archify's supported ARCHIFY_CHROME setting passed without disabling browser protections.
- Known minor: optional, lazy MapLibre chunk is approximately 1.07 MB uncompressed (292 KB gzip).
  It does not block form rendering; offline availability currently precaches it. Optimize before wider field rollout.
- No deployment, cloud purchase, production data or external notification performed.
- Database-image extension: scanning the initial PostGIS 17/3.5 image revealed Debian 11
  components with high/critical findings. Compose now pins maintained 17/3.6 from registry
  digest metadata. Its download and validation are BLOCKED by outbound HTTP 503, not passed.
  CI includes the database-image gate. Existing database tests used the earlier image.
- Publication: GitHub CLI, Docker Hub and npm began returning HTTP 503 across all outbound
  requests after local verification. Connector read access still works; no connector capability
  for repository creation is available. Preserve local source and report publication truthfully.
