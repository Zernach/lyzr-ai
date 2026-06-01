#!/usr/bin/env bash
# Interactive Lyzr command menu.
#
# Arrow keys / j-k / ← → → move cursor
# Space                  → select/deselect current row (one at a time)
# Enter                  → run the selected row (or the highlighted row)
# q / Esc                → quit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CYAN=$'\033[38;5;87m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
REVERSE=$'\033[7m'
RESET=$'\033[0m'

CMD_KEYS=(start deploy-frontend deploy-backend deploy-both)
CMD_LABELS=(
  "Start local dev (backend + frontend)"
  "Deploy frontend (Cloudflare Pages)"
  "Deploy backend"
  "Deploy frontend + backend"
)
CMD_DESCS=(
  "runs scripts/start.sh — FastAPI :8000 and Vite :5173"
  "runs scripts/deploy_frontend.sh"
  "runs scripts/deploy_backend.sh"
  "runs deploy_frontend.sh then deploy_backend.sh"
)
CMD_ACTIONS=(
  "$SCRIPT_DIR/start.sh"
  "$SCRIPT_DIR/deploy_frontend.sh"
  "$SCRIPT_DIR/deploy_backend.sh"
  "$SCRIPT_DIR/deploy_frontend.sh && $SCRIPT_DIR/deploy_backend.sh"
)

CMD_COUNT=${#CMD_KEYS[@]}
CURSOR=-1
SELECTION_ORDER=()

# ─── terminal helpers ───────────────────────────────────────────────────────

enter_alt_screen() { printf '\033[?1049h\033[?25l'; }
leave_alt_screen() { printf '\033[?25h\033[?1049l'; }
clear_screen()     { printf '\033[H\033[2J'; }
move_to()          { printf '\033[%d;1H' "$1"; }

cleanup() { leave_alt_screen; stty "$SAVED_STTY" 2>/dev/null || true; }
SAVED_STTY="$(stty -g 2>/dev/null || true)"
trap cleanup EXIT INT TERM

# ─── selection state ────────────────────────────────────────────────────────

is_selected() {
  local target=$1 i
  for i in "${SELECTION_ORDER[@]:-}"; do
    [[ "$i" == "$target" ]] && return 0
  done
  return 1
}

selection_position() {
  local target=$1 i pos=0
  for i in "${SELECTION_ORDER[@]:-}"; do
    pos=$((pos + 1))
    if [[ "$i" == "$target" ]]; then
      printf '%d' "$pos"
      return 0
    fi
  done
  return 1
}

select_current() {
  [[ $CURSOR -ge 0 ]] || return 0
  if is_selected "$CURSOR"; then
    SELECTION_ORDER=()
  else
    SELECTION_ORDER=("$CURSOR")
  fi
}

# ─── render ─────────────────────────────────────────────────────────────────

draw() {
  clear_screen
  move_to 1
  printf '%s%sLyzr%s\n'  "$BOLD" "$CYAN" "$RESET"
  printf '%s↑↓←→ / jk: move  •  Space: select  •  Enter: run  •  q: quit%s\n\n' "$DIM" "$RESET"

  local i marker order_text label desc key line
  for (( i=0; i<CMD_COUNT; i++ )); do
    key="${CMD_KEYS[$i]}"
    label="${CMD_LABELS[$i]}"
    desc="${CMD_DESCS[$i]}"
    if is_selected "$i"; then
      marker="[x]"
      order_text="$(printf '%2d' "$(selection_position "$i")")"
    else
      marker="[ ]"
      order_text="--"
    fi
    line="$(printf ' %s %s  %-16s  %s  %s(%s)%s' \
      "$order_text" "$marker" "$key" "$label" "$DIM" "$desc" "$RESET")"
    if [[ $CURSOR -ge 0 && $i -eq $CURSOR ]]; then
      printf '%s%s%s%s\n' "$CYAN" "$REVERSE" "$line" "$RESET"
    else
      printf '%s\n' "$line"
    fi
  done

  printf '\n%sSelected order:%s ' "$DIM" "$RESET"
  if [[ ${#SELECTION_ORDER[@]} -eq 0 ]]; then
    printf '%s(none)%s\n' "$DIM" "$RESET"
  else
    local first=1 idx
    for idx in "${SELECTION_ORDER[@]}"; do
      if [[ $first -eq 1 ]]; then first=0; else printf ', '; fi
      printf '%s' "${CMD_KEYS[$idx]}"
    done
    printf '\n'
  fi
}

# ─── input ──────────────────────────────────────────────────────────────────

# Reads one logical key into REPLY. Multi-byte escape sequences (arrow keys)
# are collapsed into a single token: UP, DOWN, LEFT, RIGHT, ESC.
read_key() {
  local k1 k2 k3
  IFS= read -rsn1 k1 || return 1
  if [[ "$k1" == $'\033' ]]; then
    if ! IFS= read -rsn1 -t 0.05 k2; then
      REPLY=ESC
      return 0
    fi
    if [[ "$k2" == "[" || "$k2" == "O" ]]; then
      IFS= read -rsn1 -t 0.05 k3 || k3=""
      case "$k3" in
        A) REPLY=UP ;;
        B) REPLY=DOWN ;;
        C) REPLY=RIGHT ;;
        D) REPLY=LEFT ;;
        *) REPLY=ESC ;;
      esac
      return 0
    fi
    REPLY=ESC
    return 0
  fi
  REPLY="$k1"
}

# ─── menu loop ──────────────────────────────────────────────────────────────

enter_alt_screen
stty -echo -icanon time 0 min 1 2>/dev/null || true

while true; do
  draw
  read_key || continue
  case "$REPLY" in
    UP|k|LEFT)
      if [[ $CURSOR -lt 0 ]]; then
        CURSOR=$((CMD_COUNT - 1))
      else
        CURSOR=$(( (CURSOR - 1 + CMD_COUNT) % CMD_COUNT ))
      fi
      ;;
    DOWN|j|RIGHT)
      if [[ $CURSOR -lt 0 ]]; then
        CURSOR=0
      else
        CURSOR=$(( (CURSOR + 1) % CMD_COUNT ))
      fi
      ;;
    " ") select_current ;;
    ""|$'\n'|$'\r') # Enter
      if [[ ${#SELECTION_ORDER[@]} -eq 0 && $CURSOR -ge 0 ]]; then
        SELECTION_ORDER=("$CURSOR")
      fi
      if [[ ${#SELECTION_ORDER[@]} -gt 0 ]]; then
        break
      fi
      printf '\a'
      ;;
    q|ESC)
      SELECTION_ORDER=()
      break
      ;;
  esac
done

leave_alt_screen
stty "$SAVED_STTY" 2>/dev/null || true
trap - EXIT INT TERM

if [[ ${#SELECTION_ORDER[@]} -eq 0 ]]; then
  echo "Cancelled."
  exit 0
fi

# ─── run ────────────────────────────────────────────────────────────────────

printf '%sLyzr%s\n' "$BOLD" "$RESET"
echo "Selected command order:"
n=1
for idx in "${SELECTION_ORDER[@]}"; do
  printf '  %d. %s — %s\n' "$n" "${CMD_KEYS[$idx]}" "${CMD_ACTIONS[$idx]}"
  n=$((n + 1))
done
echo

cd "$ROOT_DIR"
total=${#SELECTION_ORDER[@]}
i=0
for idx in "${SELECTION_ORDER[@]}"; do
  i=$((i + 1))
  printf '%s[%d/%d] %s%s\n' "$CYAN" "$i" "$total" "${CMD_KEYS[$idx]}" "$RESET"
  bash -c "${CMD_ACTIONS[$idx]}"
done

echo "Done."
