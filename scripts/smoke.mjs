const base = process.env.BASE_URL || "http://127.0.0.1:3000";

async function get(pathname, cookie = "") {
  const response = await fetch(base + pathname, { headers: cookie ? { cookie } : {} });
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const home = await get("/");
assert(home.status === 200, "首页打不开");
assert(home.text.includes("今天拍啥"), "首页没有品牌名");
assert(home.text.includes("每天10条，"), "首页标题不对");
assert(home.text.includes("拍了就有流量"), "首页标题不对");
assert(home.text.includes("专为餐饮、美业、本地生活老板准备"), "首页副标题不对");
assert(home.text.includes("免费看今日选题"), "首页按钮不对");
assert(home.text.includes("国家公祭日"), "首页没有公祭日提醒");
assert(home.text.includes("当天不做营销和娱乐内容"), "注意事项没有展示");
assert(!home.text.includes("199元") && !home.text.includes("199 元"), "首页出现了价格");
assert(!home.text.includes("开通会员"), "首页出现了会员售卖");

const calendar = await get("/calendar?month=2026-12");
assert(calendar.status === 200, "日历打不开");
assert(calendar.text.includes("注意事项"), "日历没有注意事项");
assert(calendar.text.includes("年终聚餐"), "日历没有餐饮方向");

const terms = await get("/terms");
assert(terms.text.includes("今天拍啥"), "协议没有网站名称");
assert(terms.text.includes("【联系邮箱】"), "协议占位符被删掉了");
assert(terms.text.includes("【运营方名称】"), "运营方占位符被删掉了");

const username = `smoke${Date.now().toString().slice(-6)}`;
const email = `${username}@example.com`;
const password = "smoke-pass-1";
const register = await fetch(base + "/api/auth/register", {
  method: "POST",
  headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ username, email, password, password_again: password, consent: "yes", next: "/" }),
  redirect: "manual",
});
assert(register.status === 303, `注册失败 ${register.status}`);
const cookie = (register.headers.get("set-cookie") || "").split(";")[0];
assert(cookie.startsWith("sid="), "注册没有写入登录态");
const unlocked = await get("/", cookie);
assert(unlocked.text.includes("已全部解锁") || unlocked.text.includes("今日选题已全部开放"), "登录后没有放开今日选题");
assert(!unlocked.text.includes("还有"), "登录后仍提示有选题被锁住");

const sitemap = await get("/sitemap.xml");
assert(sitemap.status === 200, "sitemap 打不开");
assert(sitemap.text.includes("https://jintianpaisha.cn/"), "sitemap 没有使用 jintianpaisha.cn");
const robots = await get("/robots.txt");
assert(robots.text.includes("https://jintianpaisha.cn/sitemap.xml"), "robots 没有指向主域名 sitemap");

const health = await get("/api/health");
assert(health.status === 200, "健康检查失败");
console.log("smoke ok");
