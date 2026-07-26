#!/bin/bash
#
# `npm run db:setup` — paste the two Supabase connection strings and this writes
# them into .env.local for you.
#
# Reading from the terminal rather than taking them as arguments keeps the
# password out of your shell history.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ENV_FILE=".env.local"

echo
echo "  ClinicMaxx database setup"
echo
echo "  Supabase dashboard -> your project -> Connect -> ORMs tab."
echo "  Copy each URI and replace [YOUR-PASSWORD] with your database password."
echo "  Nothing is echoed back, and nothing is written until both look valid."
echo

ask() { # ask <prompt> -> prints the answer on stdout
  local prompt="$1" answer=""
  while [ -z "$answer" ]; do
    printf "  %s\n  > " "$prompt" > /dev/tty
    IFS= read -r answer < /dev/tty || exit 1
    answer="${answer#"${answer%%[![:space:]]*}"}"   # trim leading space
    answer="${answer%"${answer##*[![:space:]]}"}"   # trim trailing space
    case "$answer" in
      postgres://*|postgresql://*) ;;
      "") echo "    (nothing entered — try again)" > /dev/tty ;;
      *) echo "    That does not start with postgresql:// — try again." > /dev/tty; answer="" ;;
    esac
    case "$answer" in
      *"[YOUR-PASSWORD]"*)
        echo "    That still has [YOUR-PASSWORD] in it — swap in the real password." > /dev/tty
        answer="" ;;
    esac
  done
  printf '%s' "$answer"
}

DB_URL="$(ask 'DATABASE_URL  — Transaction pooler (port 6543), used by the app:')"
echo > /dev/tty
MIG_URL="$(ask 'MIGRATION_URL — Session pooler (port 5432), used for migrations:')"
echo > /dev/tty

# Preserve the commentary, replace only the two assignments.
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
if [ -f "$ENV_FILE" ]; then cp "$ENV_FILE" "$tmp"; else cp .env.example "$tmp"; fi

python3 - "$tmp" "$DB_URL" "$MIG_URL" <<'PY'
import sys
path, db, mig = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().split("\n")
seen = {"DATABASE_URL": False, "MIGRATION_URL": False}
out = []
for line in lines:
    if line.startswith("DATABASE_URL="):
        out.append(f"DATABASE_URL={db}"); seen["DATABASE_URL"] = True
    elif line.startswith("MIGRATION_URL="):
        out.append(f"MIGRATION_URL={mig}"); seen["MIGRATION_URL"] = True
    else:
        out.append(line)
if not seen["DATABASE_URL"]:  out.append(f"DATABASE_URL={db}")
if not seen["MIGRATION_URL"]: out.append(f"MIGRATION_URL={mig}")
open(path, "w").write("\n".join(out))
PY

cp "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "  Written to $ENV_FILE (permissions 600, gitignored)."
echo
exec npm run --silent db:check
