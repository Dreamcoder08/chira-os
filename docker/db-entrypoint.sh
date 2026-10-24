#!/bin/sh
# Root is used only to prepare the data directory and drop privileges to `postgres`.
#
# The official image uses `gosu`, a static Go binary built with an outdated toolchain; it carries
# HIGH/CRITICAL findings that cannot be fixed without rebuilding it. This wrapper replaces it with
# `su-exec` (Alpine package, no Go runtime) and then delegates to the official entrypoint, which
# runs its normal logic once the effective user is `postgres`.
set -e

if [ "$(id -u)" = "0" ]; then
  : "${PGDATA:=/var/lib/postgresql/data}"
  mkdir -p "$PGDATA" /var/run/postgresql
  chown -R postgres:postgres "$PGDATA" /var/run/postgresql
  exec su-exec postgres "$0" "$@"
fi

exec docker-entrypoint.sh "$@"
