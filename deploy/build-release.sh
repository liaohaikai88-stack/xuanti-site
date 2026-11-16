#!/usr/bin/env bash
# 在开发机或 CI 上执行，不要在 1GB 的服务器上执行。
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm test
npm run build
rm -rf release
mkdir -p release/.next release/data release/deploy
cp -a .next/standalone/. release/
cp -a .next/static release/.next/static
if [[ -d public ]]; then
  cp -a public release/public
fi
cp -a data/seed release/data/seed
cp deploy/xuanti.service deploy/nginx.xuanti.conf deploy/add-swap.sh deploy/remote-install.sh deploy/install-nginx.sh release/deploy/
cp scripts/backup-db.mjs release/backup-db.mjs
tar -C release -czf xuanti-release.tar.gz .
echo "已生成 $(pwd)/xuanti-release.tar.gz"
