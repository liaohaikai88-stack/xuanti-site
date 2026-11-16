#!/usr/bin/env bash
# 在阿里云轻量服务器上执行。参数是已经上传的发布包。
# 例：sudo bash deploy/remote-install.sh /tmp/xuanti-release.tar.gz
set -euo pipefail
if [[ "$(id -u)" -ne 0 ]]; then
  echo "请用 root 执行" >&2
  exit 1
fi
ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "用法：sudo bash deploy/remote-install.sh /tmp/xuanti-release.tar.gz" >&2
  exit 1
fi

bash "$(dirname "$0")/add-swap.sh" || true
if [[ -f /opt/xuanti/deploy/add-swap.sh ]]; then
  bash /opt/xuanti/deploy/add-swap.sh || true
fi

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  NODE_VER="${NODE_VER:-v22.21.0}"
  curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz" | tar -xJ -C /usr/local --strip-components=1
fi

id xuanti >/dev/null 2>&1 || useradd --system --home-dir /opt/xuanti --shell /usr/sbin/nologin xuanti
mkdir -p /opt/xuanti /var/lib/xuanti /var/backups/xuanti
tar -xzf "$ARCHIVE" -C /opt/xuanti
chown -R xuanti:xuanti /opt/xuanti /var/lib/xuanti /var/backups/xuanti

if [[ ! -f /etc/xuanti.env ]]; then
  SECRET="$(openssl rand -hex 32)"
  ADMIN_PW="$(openssl rand -base64 18)"
  cat > /etc/xuanti.env <<EOF
NODE_ENV=production
APP_URL=http://127.0.0.1:3000
SITE_DOMAIN=jintianpaisha.cn
DATABASE_PATH=/var/lib/xuanti/app.db
BACKUP_DIR=/var/backups/xuanti
SECRET_KEY=${SECRET}
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PW}
FREE_PREVIEW_COUNT=4
MEMBERSHIP_BILLING_ENABLED=false
ANNUAL_PRICE_YUAN=199
PAYMENT_PROVIDER=manual
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
SMS_PROVIDER=none
EOF
  chmod 600 /etc/xuanti.env
  install -m 600 /dev/null /root/xuanti-admin-password.txt
  printf '%s\n' "管理员邮箱 admin@example.com" "管理员密码 ${ADMIN_PW}" > /root/xuanti-admin-password.txt
  echo "初始管理员密码写在 /root/xuanti-admin-password.txt ，看完请另行保存并删除该文件。"
fi

if command -v dnf >/dev/null 2>&1; then
  dnf install -y nginx || true
elif command -v yum >/dev/null 2>&1; then
  yum install -y nginx || true
fi

install -m 644 /opt/xuanti/deploy/xuanti.service /etc/systemd/system/xuanti.service
if [[ -d /etc/nginx/conf.d ]]; then
  install -m 644 /opt/xuanti/deploy/nginx.xuanti.conf /etc/nginx/conf.d/xuanti.conf
fi
systemctl daemon-reload
systemctl enable --now xuanti
if systemctl cat nginx >/dev/null 2>&1; then
  nginx -t && systemctl enable --now nginx && systemctl reload nginx
fi

cat >/etc/cron.d/xuanti-backup <<'EOF'
30 3 * * * xuanti DATABASE_PATH=/var/lib/xuanti/app.db BACKUP_DIR=/var/backups/xuanti /usr/local/bin/node /opt/xuanti/backup-db.mjs >> /var/log/xuanti-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/xuanti-backup

echo "服务已安装。先改 /etc/xuanti.env 里的 APP_URL，再 systemctl restart xuanti"
echo "域名解析好之后再申请证书，见 README。"
