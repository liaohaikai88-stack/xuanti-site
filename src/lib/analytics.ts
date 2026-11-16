import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { secretKey } from "./config";
import { addDays, todayShanghai } from "./dates";

const VISITOR_KEEP_DAYS = 90;
export const ANALYTICS_HEADING = "## 八、访问统计";

export const ANALYTICS_PRIVACY_SECTION = `${ANALYTICS_HEADING}
1. 我们在自己的服务器上统计每天的页面浏览量、独立访客、新注册、登录后的活跃人数和回访人数。
2. 独立访客按天计算：把 IP 地址和浏览器信息做成哈希后再去重。我们不保存原始 IP 地址。同一个哈希如果在更早的日期出现过，这一天记为回访。
3. 访客哈希最多保留 90 天，到期删除。每天的汇总数字会保留更久，里面没有 IP。
4. 若使用了百度统计，页面会加载百度的统计脚本。百度可能通过 Cookie 收集访问信息，规则以其说明为准。没有使用时不会加载这段脚本。`;

export type DayStat = {
  day: string;
  pageViews: number;
  uniqueVisitors: number;
  newRegistrations: number;
  activeUsers: number;
  returningUsers: number;
};

export function baiduTongjiId(): string | null {
  const id = (process.env.BAIDU_TONGJI_ID || "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) return null;
  return id;
}

export function baiduTongjiSnippet(id = baiduTongjiId()): string | null {
  if (!id) return null;
  return `var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?${id}";var s=document.getElementsByTagName("script")[0];if(s&&s.parentNode){s.parentNode.insertBefore(hm,s);}})();`;
}

export function shouldTrackPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.startsWith("/admin") || path.startsWith("/api") || path.startsWith("/_next")) return false;
  if (path === "/robots.txt" || path === "/sitemap.xml" || path === "/favicon.ico" || path === "/icon.svg") return false;
  return true;
}

/** Stable hash of IP and browser. The raw IP is not stored. */
export function visitorHash(ip: string, userAgent: string): string {
  const material = `${secretKey()}\n${ip.slice(0, 80)}\n${userAgent.slice(0, 300)}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

let lastPruneDay = "";

export function recordVisit(
  db: DatabaseSync,
  input: { ip: string; userAgent: string; userId?: number | null; day?: string },
): { hash: string } {
  const day = input.day || todayShanghai();
  const hash = visitorHash(input.ip, input.userAgent);
  db.prepare(
    `INSERT INTO daily_page_views (day, views) VALUES (?, 1)
     ON CONFLICT(day) DO UPDATE SET views = views + 1`,
  ).run(day);
  db.prepare("INSERT OR IGNORE INTO daily_visitors (day, visitor_hash) VALUES (?, ?)").run(day, hash);
  if (input.userId) {
    db.prepare("INSERT OR IGNORE INTO daily_active_users (day, user_id) VALUES (?, ?)").run(day, input.userId);
  }
  if (lastPruneDay !== day) {
    lastPruneDay = day;
    const cutoff = addDays(day, -VISITOR_KEEP_DAYS);
    db.prepare("DELETE FROM daily_visitors WHERE day < ?").run(cutoff);
    db.prepare("DELETE FROM daily_active_users WHERE day < ?").run(cutoff);
  }
  return { hash };
}

function shanghaiDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function countMap(rows: Array<Record<string, unknown>>, valueKey = "c"): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(String(row.day), Number(row[valueKey] ?? 0));
  return map;
}

export function listDailyStats(db: DatabaseSync, days = 30, today = todayShanghai()): DayStat[] {
  const start = addDays(today, -(days - 1));
  const views = countMap(
    db.prepare("SELECT day, views AS c FROM daily_page_views WHERE day >= ?").all(start),
  );
  const uniques = countMap(
    db.prepare("SELECT day, COUNT(*) AS c FROM daily_visitors WHERE day >= ? GROUP BY day").all(start),
  );
  const returning = countMap(
    db.prepare(
      `SELECT v.day AS day, COUNT(*) AS c
       FROM daily_visitors v
       WHERE v.day >= ?
         AND EXISTS (
           SELECT 1 FROM daily_visitors earlier
           WHERE earlier.visitor_hash = v.visitor_hash AND earlier.day < v.day
         )
       GROUP BY v.day`,
    ).all(start),
  );
  const active = countMap(
    db.prepare("SELECT day, COUNT(*) AS c FROM daily_active_users WHERE day >= ? GROUP BY day").all(start),
  );
  const startIso = new Date(`${start}T00:00:00+08:00`).toISOString();
  const registrations = new Map<string, number>();
  for (const row of db.prepare("SELECT created_at FROM users WHERE created_at >= ?").all(startIso)) {
    const day = shanghaiDay(String(row.created_at));
    registrations.set(day, (registrations.get(day) ?? 0) + 1);
  }
  const series: DayStat[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    series.push({
      day,
      pageViews: views.get(day) ?? 0,
      uniqueVisitors: uniques.get(day) ?? 0,
      newRegistrations: registrations.get(day) ?? 0,
      activeUsers: active.get(day) ?? 0,
      returningUsers: returning.get(day) ?? 0,
    });
  }
  return series;
}

export function ensureAnalyticsPrivacyClause(db: DatabaseSync): void {
  const row = db.prepare("SELECT content FROM legal_docs WHERE slug = 'privacy'").get();
  if (!row) return;
  let content = String(row.content);
  let changed = false;
  if (!content.includes(ANALYTICS_HEADING)) {
    content = `${content.trimEnd()}\n\n${ANALYTICS_PRIVACY_SECTION}\n`;
    changed = true;
  }
  if (!content.includes("## 九、文案助手")) {
    content = `${content.trimEnd()}\n\n## 九、文案助手与热点选题\n1. 当你使用「问问 AI」时，我们会把你输入的店铺情况和问题发给大模型服务商，用来生成回复，并保存在本站，方便你继续查看。\n2. 实时热点只保存公开热榜的标题、排名、热度和来源链接，不转载第三方正文。据此生成的「热点选题」是原创的门店拍法，不是新闻复述。\n3. 没有接上写作助手时，你写的内容不会发送出去。\n`;
    changed = true;
  }
  const plain: Array<[string, string]> = [
    ["发送给所配置的大模型服务商，用来生成回复，并在服务器保存对话", "发给大模型服务商，用来生成回复，并保存在本站"],
    ["未配置大模型时，文案助手不会把你的内容发送出去。", "没有接上写作助手时，你写的内容不会发送出去。"],
    ["若配置了百度统计，页面会加载百度的统计脚本。百度可能通过 Cookie 收集访问信息，规则以其说明为准。未配置时不会加载这段脚本。", "若使用了百度统计，页面会加载百度的统计脚本。百度可能通过 Cookie 收集访问信息，规则以其说明为准。没有使用时不会加载这段脚本。"],
  ];
  for (const [from, to] of plain) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      changed = true;
    }
  }
  if (changed) {
    db.prepare("UPDATE legal_docs SET content = ?, updated_at = ? WHERE slug = 'privacy'").run(content, new Date().toISOString());
  }
}
