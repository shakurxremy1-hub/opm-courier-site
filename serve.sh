#!/usr/bin/env bash
# serve.sh — local preview at http://localhost:8899
# Python's http.server is enough for the canvas frame flight (plain image GETs).
# GitHub Pages serves HTTP range requests; python does not — only matters if you
# add scrubbed <video>, which this template deliberately doesn't.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8899}"
echo "serving $(pwd) at http://localhost:$PORT  (Ctrl-C to stop)"
exec python3 -m http.server "$PORT"
