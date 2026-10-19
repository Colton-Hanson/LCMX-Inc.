#!/usr/bin/env bash
# User-space Postgres for a machine without Docker.
# Listens on 127.0.0.1:5432. User postgres, password postgres, database shared_expense_dev.
# Data stays in ~/.local/share/lcmx-postgres.

set -euo pipefail

BASE="${HOME}/.local/share/lcmx-postgres"
BIN="${BASE}/embedded_postgres/pginstall/bin"
DATA="${BASE}/data"
LOG="${BASE}/postgres.log"

install_binaries() {
  if [[ -x "${BIN}/pg_ctl" ]]; then
    return
  fi

  local repo_backend src site
  repo_backend="$(cd "$(dirname "$0")/.." && pwd)"
  src="$(find "${repo_backend}/.venv" -path '*/embedded_postgres/pginstall/bin/initdb' -print -quit || true)"
  if [[ -z "${src}" ]]; then
    echo "Postgres binaries are missing. From backend/: .venv/bin/pip install embedded-postgres" >&2
    exit 1
  fi

  site="$(cd "$(dirname "${src}")/../../.." && pwd)"
  mkdir -p "${BASE}"
  cp -a "${site}/embedded_postgres" "${BASE}/embedded_postgres"
  cp -a "${site}/embedded_postgres.libs" "${BASE}/embedded_postgres.libs"
}

init_if_needed() {
  if [[ -f "${DATA}/PG_VERSION" ]]; then
    return
  fi

  umask 077
  local pwfile
  pwfile="$(mktemp)"
  printf 'postgres\n' > "${pwfile}"
  chmod 600 "${pwfile}"
  "${BIN}/initdb" \
    -D "${DATA}" \
    -U postgres \
    --auth-local=trust \
    --auth-host=scram-sha-256 \
    --encoding=UTF8 \
    --locale=C \
    --pwfile="${pwfile}"
  rm -f "${pwfile}"
}

ensure_database() {
  export PGPASSWORD=postgres
  local exists
  exists="$("${BIN}/psql" -h 127.0.0.1 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='shared_expense_dev'")"
  if [[ "${exists}" != "1" ]]; then
    "${BIN}/createdb" -h 127.0.0.1 -U postgres shared_expense_dev
  fi
}

command_name="${1:-start}"
case "${command_name}" in
  start)
    install_binaries
    init_if_needed
    if "${BIN}/pg_ctl" -D "${DATA}" status >/dev/null 2>&1; then
      echo "Postgres is already running."
    else
      "${BIN}/pg_ctl" -D "${DATA}" -l "${LOG}" -w start
    fi
    ensure_database
    echo "Postgres is ready at 127.0.0.1:5432, database shared_expense_dev, user postgres."
    ;;
  stop)
    "${BIN}/pg_ctl" -D "${DATA}" -w stop
    ;;
  status)
    "${BIN}/pg_ctl" -D "${DATA}" status
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
