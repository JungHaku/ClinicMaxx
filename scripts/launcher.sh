#!/bin/bash
#
# ClinicMaxx.app launcher.
#
# A double-clicked .app does NOT inherit the login shell's PATH — it gets a bare
# /usr/bin:/bin — so Homebrew's node is invisible unless we go looking for it.
# Everything below assumes nothing about the environment.

set -u

PROJECT_DIR="__PROJECT_DIR__"
APP_NAME="ClinicMaxx"

# --- surface errors as a real dialog, not a silent bounce in the Dock --------
die() {
  /usr/bin/osascript -e "display alert \"$APP_NAME couldn't start\" message \"$1\" as critical" >/dev/null 2>&1
  exit 1
}

# --- find node -------------------------------------------------------------
for d in /opt/homebrew/bin /usr/local/bin /opt/local/bin "$HOME/.volta/bin" \
         "$HOME/.local/bin" "$HOME/.nvm/versions/node"/*/bin \
         "$HOME/.fnm/aliases/default/bin" "$HOME/Library/Application Support/fnm/aliases/default/bin"; do
  [ -x "$d/node" ] && PATH="$d:$PATH"
done
export PATH

command -v node >/dev/null 2>&1 || die "Node.js could not be found.

Install it (for example: brew install node) and open $APP_NAME again."

[ -d "$PROJECT_DIR" ] || die "The project folder is missing:

$PROJECT_DIR

If you moved or renamed the ClinicMaxx folder, re-run scripts/make-app.sh from inside it."

cd "$PROJECT_DIR" || die "Could not open $PROJECT_DIR"

[ -d node_modules ] || die "Dependencies are not installed.

Open Terminal, then run:
    cd \"$PROJECT_DIR\"
    npm install"

# --- reuse an already-running ClinicMaxx before starting a second one -------
is_ours() {
  /usr/bin/curl -s --max-time 2 "http://127.0.0.1:$1/dashboard" 2>/dev/null | grep -q "ClinicMaxx"
}
port_busy() { /usr/bin/nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

PORT=""
for p in $(seq 3000 3010); do
  if port_busy "$p" && is_ours "$p"; then
    /usr/bin/open "http://localhost:$p/dashboard"
    exit 0
  fi
done

# --- otherwise claim the first genuinely free port -------------------------
for p in $(seq 3000 3010); do
  if ! port_busy "$p"; then PORT="$p"; break; fi
done
[ -n "$PORT" ] && export PORT || die "Ports 3000-3010 are all in use.

Quit whatever is using them and try again."

LOG="${TMPDIR:-/tmp}/clinicmaxx-launcher.log"
: > "$LOG"

npm run dev >>"$LOG" 2>&1 &
SERVER_PID=$!

# Quitting the app should take the server with it.
cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
  pkill -P "$SERVER_PID" 2>/dev/null
  exit 0
}
trap cleanup EXIT INT TERM

# --- wait for the server, then hand over to the browser --------------------
for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    die "The server stopped while starting up.

Last few lines of the log:

$(tail -n 12 "$LOG")"
  fi
  if port_busy "$PORT"; then
    /usr/bin/open "http://localhost:$PORT/dashboard"
    break
  fi
  sleep 0.5
done

# Stay in the foreground so the app keeps a Dock presence and can be quit,
# which is what stops the server.
wait "$SERVER_PID"
