#!/data/data/com.termux/files/usr/bin/bash
set -e
cd -- "$(dirname -- "$0")"
printf '%s\n' 'WORLD GUARD: open http://127.0.0.1:8000/ in your browser. Stop with Ctrl+C.'
exec python -m http.server 8000 --bind 127.0.0.1
