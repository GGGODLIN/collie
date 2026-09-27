#!/bin/bash
# The live suite's world: a throwaway Herdr session the active Collie fronts as `?s=collie-e2e`.
#
#   session.sh up     build it (about a minute)
#   session.sh down   stop and delete the session, kill its server, remove the scratch repo
#
# Two workspaces, one pane per switcher section:
#
#   e2e-fixture   a fresh mktemp git repo with two uncommitted files
#     shell       a plain shell
#     agent       `claude` parked on its folder-trust question -> blocked -> Needs you
#   e2e-agents    $HOME/.cache/collie-e2e/agents, a folder under the trusted home, so no trust question
#     ready-old   ccp-free, one short reply, never looked at     -> done -> Ready · unseen
#     ready-new   the same, a few seconds later                  -> Ready · unseen, listed first
#     recent      the same, then read once through Collie        -> seen -> Recent
#     working     ccp-free running `sleep 600`                   -> working -> Working
#
# The four ccp-free agents spend only the free pool. The mktemp folder is outside the trusted home,
# so the plain `claude` always opens on the trust question and never sends a prompt.
set -euo pipefail

SESSION=collie-e2e
STATE_DIR="${TMPDIR:-/tmp}/collie-e2e-state"
REPO_FILE="$STATE_DIR/repo"
PID_FILE="$STATE_DIR/server.pid"
AGENTS_DIR="$HOME/.cache/collie-e2e/agents"

# The caller is often a Claude Code session inside a Herdr pane. Its CLAUDE_* variables would reach
# every agent in the test session (a child-session marker switches transcripts off, and the
# messaging token is that session's own credential), and its HERDR_* variables would point every
# call at the operator's session. The server starts with all of them removed.
STRIP=()
while IFS='=' read -r key _; do
  case "$key" in CLAUDE* | CODEX_COMPANION* | HERDR_*) STRIP+=(-u "$key") ;; esac
done < <(env)

h() { env "${STRIP[@]}" herdr --session "$SESSION" "$@"; }

json() { python3 -c "import json,sys; d=json.load(sys.stdin)['result']; print($1)"; }

status_of() { h agent get "$1" 2>/dev/null | json 'd["agent"]["agent_status"]' 2>/dev/null || true; }

# Wait until `$1` (a pane id or agent name) reports one of the statuses in `$2` (a regex).
wait_status() {
  local s=""
  for _ in $(seq 1 "${3:-120}"); do
    s=$(status_of "$1")
    [[ "$s" =~ ^($2)$ ]] && return 0
    sleep 0.5
  done
  echo "timed out waiting for $1 to reach $2 (last: ${s:-none})" >&2
  return 1
}

# A ccp-free Claude named `$2` in workspace `$1`: in pane `$3` when given (the workspace's own root
# pane, so no stray shell row is left behind), else in a new tab. Returns once it takes input.
free_agent() {
  local pane="${3:-}"
  if [ -z "$pane" ]; then
    pane=$(h tab create --workspace "$1" --cwd "$AGENTS_DIR" --label "$2" --no-focus | json 'd["root_pane"]["pane_id"]')
  fi
  h pane run "$pane" "zsh -ic 'ccp-free'" >/dev/null
  wait_status "$pane" 'idle|done'
  h agent rename "$pane" "$2" >/dev/null
}

say_ok() { h agent prompt "$1" "Reply with exactly one word: ok" --wait --timeout 120000 >/dev/null; }

pane_of() { h agent get "$1" | json 'd["agent"]["pane_id"]'; }

# "Seen" is Collie's own fact, not Herdr's: a pane is seen when Collie serves its mirror to a read
# carrying `x-collie-seen` (bridge/server.ts, ADR 0003). Asked through the tailnet front door, the
# same door the suite drives, because plain loopback answers 403 without the identity header.
front_door() {
  local host
  host=$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
  echo "${COLLIE_E2E_BASE_URL:-https://$host:${COLLIE_E2E_PORT:-8443}}"
}

collie_mark_seen() {
  local id
  id=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1")
  curl -fsS -o /dev/null -H 'x-collie-seen: 1' -H 'x-requested-with: XMLHttpRequest' \
    "$(front_door)/api/pane/$id?session=$SESSION"
}

# True once Collie's own snapshot has the pane settled (done or idle) AND seen after its last change.
# A seen read that lands before Collie noticed the turn ending is overtaken by that change, so the
# check is on Collie's answer, not on the read having returned 200.
collie_seen() {
  curl -fsS "$(front_door)/api/snapshot?session=$SESSION" | python3 -c '
import json, sys
pane = sys.argv[1]
for a in json.load(sys.stdin)["agents"]:
    if a["paneId"] == pane:
        ok = a.get("status") in ("done", "idle") and (a.get("lastSeenAt") or 0) >= (a.get("lastActiveAt") or 0)
        sys.exit(0 if ok else 1)
sys.exit(1)' "$1"
}

up() {
  if herdr session list | awk '{print $1}' | grep -qx "$SESSION"; then
    echo "session $SESSION already exists; run: $0 down" >&2
    exit 1
  fi
  mkdir -p "$STATE_DIR" "$AGENTS_DIR"

  nohup env "${STRIP[@]}" herdr --session "$SESSION" server >"$STATE_DIR/server.log" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in $(seq 1 50); do
    h workspace list >/dev/null 2>&1 && break
    sleep 0.2
  done

  repo=$(mktemp -d "${TMPDIR:-/tmp}/collie-e2e-repo.XXXXXX")
  echo "$repo" >"$REPO_FILE"
  git -C "$repo" init -q -b main
  printf 'hello\n' >"$repo/notes.md"
  git -C "$repo" add notes.md
  git -C "$repo" -c user.name=e2e -c user.email=e2e@example.test commit -q -m "chore: seed the e2e repo"
  printf 'hello\nchanged line\n' >"$repo/notes.md"
  printf 'new\n' >"$repo/added.txt"

  fixture=$(h workspace create --cwd "$repo" --label e2e-fixture --no-focus | json 'd["workspace"]["workspace_id"]')
  h tab rename "$fixture:t1" shell >/dev/null 2>&1 || true
  pane=$(h tab create --workspace "$fixture" --cwd "$repo" --label agent --no-focus | json 'd["root_pane"]["pane_id"]')
  # `agent start` reports agent_not_ready when Claude opens on the trust question. That is the
  # state this world wants, so the non-zero exit is expected and the state is checked instead.
  h agent start e2e-claude --kind claude --pane "$pane" --timeout 40000 >/dev/null 2>&1 || true
  wait_status e2e-claude blocked 80

  created=$(h workspace create --cwd "$AGENTS_DIR" --label e2e-agents --no-focus)
  agents=$(echo "$created" | json 'd["workspace"]["workspace_id"]')
  h tab rename "$agents:t1" ready-old >/dev/null
  free_agent "$agents" ready-old "$(echo "$created" | json 'd["root_pane"]["pane_id"]')"
  for name in ready-new recent working; do free_agent "$agents" "$name"; done

  say_ok ready-old
  # A clear gap, so "the latest state change first" has two different timestamps to order.
  sleep 3
  say_ok ready-new
  say_ok recent
  recent_pane=$(pane_of recent)
  # Collie learns about a turn ending on its next sweep; mark, then confirm on Collie's own snapshot.
  for _ in $(seq 1 30); do
    collie_mark_seen "$recent_pane" 2>/dev/null || true
    sleep 1
    collie_seen "$recent_pane" && break
  done
  collie_seen "$recent_pane" || { echo "Collie never saw recent as seen" >&2; exit 1; }
  h agent prompt working "Use the Bash tool to run exactly this command and nothing else: sleep 600. Then reply done." >/dev/null
  wait_status working working 120

  for name in e2e-claude ready-old ready-new recent working; do printf '%s=%s ' "$name" "$(status_of "$name")"; done
  echo
  echo "up: session=$SESSION fixture=$fixture agents=$agents repo=$repo"
}

down() {
  h session stop "$SESSION" >/dev/null 2>&1 || herdr session stop "$SESSION" >/dev/null 2>&1 || true
  if [ -f "$PID_FILE" ]; then kill "$(cat "$PID_FILE")" 2>/dev/null || true; fi
  herdr session delete "$SESSION" >/dev/null 2>&1 || true
  if [ -f "$REPO_FILE" ]; then rm -rf "$(cat "$REPO_FILE")"; fi
  rm -rf "$STATE_DIR"
  if herdr session list | awk '{print $1}' | grep -qx "$SESSION"; then
    echo "down: session $SESSION is still listed" >&2
    exit 1
  fi
  echo "down: session $SESSION removed"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 up|down" >&2; exit 2 ;;
esac
