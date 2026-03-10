#!/bin/bash
set -e

if [ ! -f "/home/dev/.claude.json" ]; then
  echo '{}' > "/home/dev/.claude.json"
fi

exec "$@"
