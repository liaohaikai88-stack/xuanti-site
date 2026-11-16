# 今天拍啥

给餐饮、美业、本地生活老板用的抖音 / 小红书选题站。每天放出可直接拍摄的题目和开头钩子，附带热点日历、爆款拆解和文案提纲。

网站名称是「今天拍啥」。主域名是 `jintianpaisha.cn`。域名从环境变量 `SITE_DOMAIN` 读取，访问地址从 `APP_URL` 读取。本地开发时 `APP_URL` 用 localhost，sitemap 和 robots 仍默认指向 `https://jintianpaisha.cn`。换域名不用改代码。

当前不收费。未登录只能看今天的前几条选题、热点日历和拆解导语；注册登录后可以看全部选题、往日、搜索和收藏。会员、订单和支付代码留在后台，由 `MEMBERSHIP_BILLING_ENABLED` 控制，默认关闭。

## 本地运行

需要 Node.js 22。一条命令：

```bash
./scripts/dev.sh
```

脚本会在没有 `.env` 时复制 `.env.example`，安装依赖，然后启动开发服务器。浏览器打开 http://localhost:3000 。

管理员来自 `.env` 里的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`。示例值只给本机用。第一次打开网站时会写入数据库，已经存在的管理员不会被改密码。

常用命令：

```bash
npm test          # 注册、权限、选题和日历导入
npm run build     # 生产构建
npm start         # 运行构建结果，生产模式必须先改 SECRET_KEY
npm run smoke     # 对已启动的站点做一次访问检查，地址用 BASE_URL
```

## 访客能做什么

- 首页看今天的选题。未登录默认看前 4 条（可用 `FREE_PREVIEW_COUNT` 调成 3 到 5）。
- 选题卡片可以一键复制标题和开头钩子。
- 热点日历免费。十二月的真实节点来自策划表，国家公祭日这类注意事项会单独标出来。
- 行业选题库可以按餐饮、美业、本地生活浏览。搜索、收藏、往日选题和完整拆解需要登录。
- 文案工具：填一个产品，得到标题和提纲。没填 `LLM_API_KEY` 时用本地提纲，站点照常可用。
- 注册必须勾选用户协议和隐私政策。协议里的网站名称已写成「今天拍啥」，【运营方名称】【联系邮箱】【日期】【服务器所在地，如：中国香港】仍留在文案里，上线前到后台改掉。

## 环境变量

复制 `.env.example` 为 `.env`。不要把填了真实密码的 `.env` 提交上来，仓库是公开的。

| 变量 | 作用 |
| --- | --- |
| `APP_URL` | 站点实际地址。本地 `http://localhost:3000`，上线后改成 `https://jintianpaisha.cn`。不是 localhost 时，sitemap 和 robots 改用这个地址。 |
| `SITE_DOMAIN` | 主域名，默认 `jintianpaisha.cn`。页脚、sitemap 和 robots 会用它。 |
| `DATABASE_PATH` | SQLite 文件。服务器上用 `/var/lib/xuanti/app.db`。 |
| `SECRET_KEY` | 会话胡椒。生产环境如果还是示例字符串，进程会拒绝启动。用 `openssl rand -hex 32` 生成。 |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 首次启动创建管理员。 |
| `FREE_PREVIEW_COUNT` | 未登录每天能看的条数，限制在 3 到 5。 |
| `MEMBERSHIP_BILLING_ENABLED` | `false` 时不显示价格和订单，登录即全开。`true` 时免费账号只看预览，年度会员看全部。 |
| `ANNUAL_PRICE_YUAN` | 以后收费时的年费，默认 199。关闭收费时页面上不会出现。 |
| `PAYMENT_PROVIDER` | 现在只用 `manual`。`wechat` / `alipay` 会明确报尚未接入。 |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | OpenAI 兼容接口。密钥留空则走本地提纲。 |
| `SMS_PROVIDER` | 手机验证码登录的预留，保持 `none`。 |

## 后台

用管理员账号登录后打开 `/admin`。

- 选题、日历、拆解、行业、用户、协议都可以增删改。
- 选题 CSV 表头：`行业,选题标题,开头钩子,适合平台,内容形式`，可选 `发布日期,排序`。文件用 UTF-8。
- 日历 CSV 表头：`日期,节点,建议提前准备,餐饮选题方向,美业选题方向,本地生活选题方向,注意事项`。日期可以写 `12月7日`、`12月1日起`、`12月24日-25日`。导入时填写十二月所在的年份。
- 同一标题的选题、同一日期加节点的日历，重复导入会跳过。
- 协议正文在「协议」里改，保存后前台立刻生效。
- 订单页可以人工开通年度会员。收费开关关闭时，这个状态不影响前台权限。

种子数据：`data/seed/topics.csv` 的 30 条是策划给的正式选题，不标示例。`data/seed/calendar.csv` 是十二月正式节点，不标示例。拆解和更早一天的几条选题标了「示例」。

## 部署到阿里云轻量（香港）

机器大约是 2 核、900MB 内存、没有 swap、30GB 磁盘，系统是 Alibaba Cloud Linux 4。不要在这台机器上执行 `npm run build` 或 `docker compose build`，Next.js 构建会把内存吃满。

在自己的电脑或 CI 上打包，服务器只跑已经构建好的 Node 进程。运行时大约一两百 MB。数据库是 SQLite，没有单独的数据库服务。

### 1. 加 swap

内存只有约 900MB，建议先加 2GB swap，避免偶发峰值被系统杀掉：

```bash
sudo bash deploy/add-swap.sh
```

### 2. 在构建机打包

```bash
./deploy/build-release.sh
```

得到 `xuanti-release.tar.gz`。

### 3. 上传并在服务器安装

安全组先放行 22 和 80。443 等证书申请时再放行。

```bash
scp xuanti-release.tar.gz root@你的服务器:/tmp/xuanti-release.tar.gz
ssh root@你的服务器
mkdir -p /tmp/xuanti-pkg
tar -xzf /tmp/xuanti-release.tar.gz -C /tmp/xuanti-pkg deploy/remote-install.sh deploy/add-swap.sh
bash /tmp/xuanti-pkg/deploy/remote-install.sh /tmp/xuanti-release.tar.gz
```

脚本会安装 Node.js 22、创建系统用户、把站点放到 `/opt/xuanti`、生成 `/etc/xuanti.env`、用 systemd 启动 `xuanti`，并尽量装上 Nginx。管理员初始密码在 `/root/xuanti-admin-password.txt`，抄下来之后删掉这个文件，再把 `/etc/xuanti.env` 里的邮箱改成你自己的。

先在服务器上确认：

```bash
systemctl status xuanti
curl -fsS http://127.0.0.1:3000/api/health
```

浏览器访问服务器公网 IP，应该能打开首页。

### 4. 域名和 HTTPS

域名买好并解析到这台机器之后：

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d jintianpaisha.cn
```

然后编辑 `/etc/xuanti.env`：

```bash
APP_URL=https://jintianpaisha.cn
SITE_DOMAIN=jintianpaisha.cn
```

```bash
sudo systemctl restart xuanti
```

证书续期一般由 certbot 的 timer 处理。如果软件源里没有 certbot，可以用 [certbot 官方安装说明](https://certbot.eff.org/) 里适合 RHEL 系的方式，Nginx 配置在 `deploy/nginx.xuanti.conf`。

### 5. 备份

安装脚本会加一条每天 03:30 的 cron，把数据库真空备份到 `/var/backups/xuanti`，默认保留 14 天。也可以手动：

```bash
sudo -u xuanti DATABASE_PATH=/var/lib/xuanti/app.db BACKUP_DIR=/var/backups/xuanti /usr/local/bin/node /opt/xuanti/backup-db.mjs
```

恢复时停掉服务，用备份文件换掉 `/var/lib/xuanti/app.db`，再启动。

### 更新版本

在构建机重新打包，上传后覆盖 `/opt/xuanti` 里的程序文件，保留 `/var/lib/xuanti/app.db` 和 `/etc/xuanti.env`，然后 `systemctl restart xuanti`。不要覆盖数据库。

### Docker

`docker compose up --build` 可以在内存充足的机器上用。1GB 的轻量服务器请用上面的 systemd 方式，镜像在别处构建好再 `docker load`，不要在小机器上 build。

## 收费以后怎么打开

营业执照和支付渠道准备好之前，保持 `MEMBERSHIP_BILLING_ENABLED=false`。

要打开时：

1. 把该变量设为 `true` 并重启。
2. 前台会出现「升级」和定价页，免费账号回到每天前几条。
3. 用户提交订单后，管理员在后台「订单」里点开通。支付接口在 `src/lib/billing.ts` 的 `PaymentProvider`，接微信支付或支付宝时实现它，并把 `PAYMENT_PROVIDER` 改成对应值。
4. 文案工具在收费打开后按次扣次数，管理员可以在用户页增减次数。

手机验证码登录的接口在 `src/lib/sms.ts`，现在没有接入。

## 上线前还要做

- 把用户协议、隐私政策里的【运营方名称】【联系邮箱】【日期】【服务器所在地，如：中国香港】换成真实信息。模板建议请律师看过。
- 换掉管理员密码和 `SECRET_KEY`。
- 确认 `APP_URL` 是对外的 https 地址。
- 服务器放在中国香港，隐私政策里的存储地点要和实际一致。
