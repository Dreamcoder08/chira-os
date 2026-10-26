# Deploying a demonstration instance

This is a runbook for a host that a person controls. It has been written from
the repository's verified behaviour, not from a deployment that ran: **no
production instance exists today**, and nothing below has been executed against
a real server. Read it as a procedure with an unproven last mile, not as a
receipt.

## What is already proven

- CI builds the image (`docker build -t chira-os:local .`), scans it, scans the
  database, and restores a backup on every run.
- The published image workflow pushes the same Dockerfile to
  `ghcr.io/dreamcoder08/chira-os`, tagged with the commit and `latest`.
- The pilot origin serves the built shell over HTTPS with a service worker that
  takes control, verified by `pnpm pilot:check` on a LAN.
- Integration tests cover tenant isolation with row-level security, immutable
  evidence, and the sampling round-trip.

## What a demonstration instance needs

| Piece                              | Why                                                                 | Notes                                               |
| ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| A host with Docker and a public IP | Runs the API, the worker and PostGIS                                | 2 vCPU / 2 GB is the smallest sane size             |
| A DNS name pointing at it          | The app's origin must be stable                                     | `APP_ORIGIN` must match exactly, including scheme   |
| TLS termination                    | Session cookies and the service worker need a secure context        | Caddy in front of `127.0.0.1:3001`                  |
| Secrets                            | `POSTGRES_PASSWORD`, the three role passwords, `BETTER_AUTH_SECRET` | Generate them on the host; never commit them        |
| Off-host backup target             | Losing PostGIS loses every record                                   | `pnpm backup` writes a directory; copy it elsewhere |

`.env.example` lists every variable the application reads. The three database
roles (`chira_app`, `chira_auth`, `chira_worker`) are created by the migrations
with restricted privileges; the API never connects as the owner.

## Procedure

1. Create the database once, with the owner credentials only:
   `docker compose build db && docker compose up -d --wait db`.
2. Write `.env` on the host from `.env.example`, with fresh secrets.
3. Run `pnpm db:migrate`, then create accounts with `pnpm user:create`. There is
   no self-registration.
4. Start the application and the worker from the published image, not from a
   checkout, so the process runs exactly what CI verified.
5. Put Caddy in front with a real certificate and proxy `/api/*` and `/health/*`
   to `127.0.0.1:3001`.
6. Run `APP_ORIGIN=<public origin> pnpm pilot:check`-equivalent checks against
   the public origin, and confirm the service worker registers.
7. Schedule `pnpm backup` and copy the result off the host. Test the restore
   once, before trusting it.

## What this runbook deliberately does not claim

- That the instance will survive load: nothing here has been load-tested.
- That a public deployment is safe for real producer data. The application still
  declares itself unfit for production, and the pilot protocol forbids real data.
- That a demonstration should be public at all. Publishing infrastructure is a
  decision with an owner, and that owner is not the agent.
