#!/usr/bin/env bash
# 在约 1GB 内存、没有 swap 的轻量服务器上执行一次。
set -euo pipefail
if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 执行：sudo bash deploy/add-swap.sh" >&2
  exit 1
fi
if swapon --show | grep -q /swapfile; then
  echo "swap 已经开着"
  exit 0
fi
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo "已添加 2GB swap"
swapon --show
