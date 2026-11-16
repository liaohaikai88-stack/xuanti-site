#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "已根据 .env.example 生成 .env，本机开发可以直接用。"
fi
if [[ ! -d node_modules ]]; then
  npm install
fi
mkdir -p data
exec npm run dev
