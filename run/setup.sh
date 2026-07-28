#!/usr/bin/env sh
set -eu

PORT="${PORT:-8080}"

case "${1:-}" in
  --start)
    exec python3 -m http.server "$PORT"
    ;;
  "")
    exit 0
    ;;
  *)
    echo "Usage: $0 [--start]" >&2
    exit 2
    ;;
esac
