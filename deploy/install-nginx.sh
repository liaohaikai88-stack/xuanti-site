#!/usr/bin/env bash
# 安装 Nginx 站点配置。已有证书或 Certbot 改过的文件不会被 HTTP 模板覆盖。
install_nginx_site() {
  local dest="${NGINX_SITE_CONF:-/etc/nginx/conf.d/xuanti.conf}"
  local domain="${SITE_DOMAIN:-jintianpaisha.cn}"
  local cert_dir="${LETSENCRYPT_LIVE:-/etc/letsencrypt/live/${domain}}"
  local parent
  parent="$(dirname "$dest")"
  mkdir -p "$parent"

  if [[ -f "$dest" ]] && grep -Eq 'ssl_certificate|letsencrypt|managed by Certbot|Certbot' "$dest"; then
    echo "保留已有的 HTTPS 配置：$dest"
    return 0
  fi

  if [[ -f "${cert_dir}/fullchain.pem" && -f "${cert_dir}/privkey.pem" ]]; then
    cat > "$dest" <<EOF
server {
    listen 80;
    server_name ${domain} www.${domain};
    return 301 https://${domain}\$request_uri;
}

server {
    listen 443 ssl;
    server_name www.${domain};
    ssl_certificate ${cert_dir}/fullchain.pem;
    ssl_certificate_key ${cert_dir}/privkey.pem;
    return 301 https://${domain}\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${domain};
    ssl_certificate ${cert_dir}/fullchain.pem;
    ssl_certificate_key ${cert_dir}/privkey.pem;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
    echo "已写入 HTTPS 配置：$dest"
    return 0
  fi

  cat > "$dest" <<'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
  echo "已写入 HTTP 配置：$dest"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_nginx_site
fi
