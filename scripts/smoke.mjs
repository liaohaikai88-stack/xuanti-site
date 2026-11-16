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
assert(home.text.includes("今天拍这条"), "首页没有今天拍这条");
assert(!home.text.includes("按我的店改写"), "未登录不该看到改写入口");
assert(!home.text.includes(">问问AI<"), "未登录不该看到问问AI");
assert(/共[\s\S]{0,24}\d+[\s\S]{0,24}条/.test(home.text), "首页没有用实际条数");
assert(home.text.includes("实时热点"), "首页没有热点条");
assert(home.text.includes("我的收藏"), "首页没有收藏入口");
assert(!home.text.includes("爆款拆解"), "首页不该展示爆款拆解");
assert(!home.text.includes("带「示例」"), "页脚不该写示例说明");
assert(!home.text.includes("当天不做营销和娱乐内容"), "公祭日提醒不该一直出现在首页");
assert(!home.text.includes("199元") && !home.text.includes("199 元"), "首页出现了价格");
assert(!home.text.includes("开通会员"), "首页出现了会员售卖");
assert(!home.text.includes("hm.baidu.com"), "未配置时不该加载百度统计");

const calendar = await get("/calendar?month=2026-12");
assert(calendar.status === 200, "日历打不开");
assert(calendar.text.includes("注意事项"), "日历没有注意事项");
assert(calendar.text.includes("国家公祭日"), "日历没有公祭日");
assert(calendar.text.includes("当天不做营销和娱乐内容"), "注意事项没有展示");
assert(calendar.text.includes("年终聚餐"), "日历没有餐饮方向");
const casesPage = await get("/cases");
assert(casesPage.status === 404, "拆解开关关闭时应返回 404");
assert(casesPage.text.includes("找不到页面"), "拆解关闭页应说明找不到页面");
assert(!casesPage.text.includes("看一条片子为什么能留住人"), "拆解正文仍在页面上");
const privacy = await get("/privacy");
assert(privacy.text.includes("不保存原始 IP"), "隐私政策没有写访问统计");
assert(privacy.text.includes("百度统计"), "隐私政策没有提到百度统计");
assert(privacy.text.includes("大模型服务商"), "隐私政策没有写 AI 会发给模型服务");

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
  body: new URLSearchParams({ username, email, password, password_again: password, consent: "yes", sub_industry: "餐饮/火锅", next: "/" }),
  redirect: "manual",
});
assert(register.status === 303, `注册失败 ${register.status}`);
const cookie = (register.headers.get("set-cookie") || "").split(";")[0];
assert(cookie.startsWith("sid="), "注册没有写入登录态");
const unlocked = await get("/", cookie);
assert(unlocked.text.includes("已登录，今日选题都在下面。"), "登录后没有放开今日选题");
assert(!unlocked.text.includes("登录后查看其余选题"), "登录后仍提示有选题被锁住");

const sitemap = await get("/sitemap.xml");
assert(sitemap.status === 200, "sitemap 打不开");
assert(sitemap.text.includes("https://jintianpaisha.cn/"), "sitemap 没有使用 jintianpaisha.cn");
const robots = await get("/robots.txt");
assert(robots.text.includes("https://jintianpaisha.cn/sitemap.xml"), "robots 没有指向主域名 sitemap");

const health = await get("/api/health");
assert(health.status === 200, "健康检查失败");
console.log("smoke ok");
