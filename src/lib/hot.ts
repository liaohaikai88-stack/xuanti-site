import type { DatabaseSync } from "node:sqlite";
import { aiEnabled, completeChat, COPYWRITER_RULES } from "./ai-client";
import { todayShanghai } from "./dates";

export type HotDraft = { rank: number; title: string; heat: string; url: string };
export type HotTrend = "up" | "down" | "same" | "new";
export type HotRow = HotDraft & {
  source: string;
  fetchedAt: string;
  trend: HotTrend;
  tags: string[];
};

const BLOCKLIST = [
  "地震", "余震", "火灾", "爆炸", "遇难", "死亡", "身亡", "遇害", "凶杀", "自杀",
  "坍塌", "矿难", "空难", "坠机", "洪水", "洪灾", "海啸", "疫情", "恐怖", "袭击",
  "战争", "炮击", "导弹", "公祭", "哀悼", "默哀", "伤亡", "重大事故", "塌方",
  "暴乱", "政变", "骚乱", "戒严", "示威", "台独", "港独", "疆独", "法轮功",
  "元首", "总统", "总书记", "首相", "会晤", "峰会", "APEC", "亚太经合", "外交部",
  "大使", "北约", "军演", "航母", "解放军", "阅兵", "国防部", "武器", "制裁",
  "车祸", "交通事故", "泥石流", "台风", "失踪", "搜救", "矿难",
  "法院", "判刑", "判决", "庭审", "被捕", "刑事", "落马", "贪污", "受贿",
];

const LIFESTYLE = [
  "电影", "电视剧", "综艺", "演唱会", "新歌", "音乐节", "时装", "穿搭", "婚礼",
  "游戏", "动漫", "球赛", "世界杯", "奥运", "春节", "中秋", "圣诞", "情人节",
];

const TAGS: Array<{ name: string; words: string[] }> = [
  { name: "餐饮", words: ["火锅", "奶茶", "咖啡", "烧烤", "外卖", "美食", "餐厅", "饭店", "小吃", "面包", "甜品", "夜宵", "早餐", "预制菜"] },
  { name: "美业", words: ["美甲", "美容", "护肤", "化妆", "口红", "发型", "染发", "医美", "面膜", "防晒"] },
  { name: "本地生活", words: ["旅游", "景点", "周末", "市集", "展览", "公园", "演唱会", "博物馆", "亲子", "探店"] },
];

export function hotEnabled(): boolean {
  const value = (process.env.HOT_ENABLED || "true").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function hotRefreshMinutes(): number {
  const parsed = Number(process.env.HOT_REFRESH_MINUTES || 30);
  if (!Number.isFinite(parsed) || parsed < 5) return 30;
  return Math.min(240, Math.floor(parsed));
}

export function isBlockedHotTitle(title: string): boolean {
  const folded = title.toLowerCase();
  return BLOCKLIST.some((word) => folded.includes(word.toLowerCase()));
}

/** Industry tags or ordinary lifestyle topics. Politics and hard news stay out of the default list. */
export function isShopRelevantHot(title: string): boolean {
  if (isBlockedHotTitle(title)) return false;
  if (relevanceTags(title).length > 0) return true;
  return LIFESTYLE.some((word) => title.includes(word));
}

export function relevanceTags(title: string): string[] {
  return TAGS.filter((tag) => tag.words.some((word) => title.includes(word))).map((tag) => tag.name);
}

export function rankTrend(current: number, previous: number | null): HotTrend {
  if (previous == null) return "new";
  if (current < previous) return "up";
  if (current > previous) return "down";
  return "same";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function parseDouyin(payload: unknown): HotDraft[] {
  const data = asRecord(asRecord(payload)?.data);
  return asList(data?.word_list).map((item, index) => {
    const row = asRecord(item) || {};
    const sentence = String(row.sentence_id || "");
    return {
      rank: Number(row.position || index + 1),
      title: String(row.word || row.sentence || "").trim(),
      heat: String(row.hot_value || ""),
      url: sentence ? `https://www.douyin.com/search/${encodeURIComponent(String(row.word || ""))}` : "",
    };
  }).filter((item) => item.title);
}

export function parseWeibo(payload: unknown): HotDraft[] {
  const data = asRecord(asRecord(payload)?.data);
  return asList(data?.realtime).map((item, index) => {
    const row = asRecord(item) || {};
    const title = String(row.word || row.note || "").trim();
    return {
      rank: Number(row.realpos || row.rank || index + 1),
      title,
      heat: String(row.num || ""),
      url: title ? `https://s.weibo.com/weibo?q=${encodeURIComponent(title)}` : "",
    };
  }).filter((item) => item.title);
}

export function parseBaidu(payload: unknown): HotDraft[] {
  const data = asRecord(asRecord(payload)?.data);
  const cards = asList(data?.cards);
  const content = asList(asRecord(cards[0])?.content);
  return content.map((item, index) => {
    const row = asRecord(item) || {};
    return {
      rank: Number(row.index || index + 1),
      title: String(row.word || row.query || "").trim(),
      heat: String(row.hotScore || row.hotTag || ""),
      url: String(row.url || row.rawUrl || ""),
    };
  }).filter((item) => item.title);
}

export function parseToutiao(payload: unknown): HotDraft[] {
  const data = asList(asRecord(payload)?.data);
  return data.map((item, index) => {
    const row = asRecord(item) || {};
    return {
      rank: index + 1,
      title: String(row.Title || row.title || "").trim(),
      heat: String(row.HotValue || row.hot_value || ""),
      url: String(row.Url || row.url || ""),
    };
  }).filter((item) => item.title);
}

export function parseBilibili(payload: unknown): HotDraft[] {
  const data = asRecord(asRecord(payload)?.data);
  return asList(data?.list).map((item, index) => {
    const row = asRecord(item) || {};
    const bvid = String(row.bvid || "");
    return {
      rank: index + 1,
      title: String(row.title || "").trim(),
      heat: String(asRecord(row.stat)?.view || ""),
      url: bvid ? `https://www.bilibili.com/video/${bvid}` : "",
    };
  }).filter((item) => item.title);
}

export const HOT_ADAPTERS: Array<{ id: string; label: string; url: string; parse: (payload: unknown) => HotDraft[] }> = [
  { id: "douyin", label: "抖音", url: "https://www.douyin.com/aweme/v1/web/hot/search/list/", parse: parseDouyin },
  { id: "weibo", label: "微博", url: "https://weibo.com/ajax/side/hotSearch", parse: parseWeibo },
  { id: "baidu", label: "百度", url: "https://top.baidu.com/api/board?tab=realtime", parse: parseBaidu },
  { id: "toutiao", label: "头条", url: "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc", parse: parseToutiao },
  { id: "bilibili", label: "哔哩哔哩", url: "https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1", parse: parseBilibili },
];

const UA = "JintianPaisha/1.0 (+https://jintianpaisha.cn)";

export async function fetchHotText(url: string, timeoutMs = 8000): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": UA, accept: "application/json,text/plain,*/*" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function sourceLabel(id: string): string {
  return HOT_ADAPTERS.find((item) => item.id === id)?.label || id;
}

export function saveHotSnapshot(db: DatabaseSync, source: string, items: HotDraft[], fetchedAt: string): number {
  const usable = items.filter((item) => item.title && !isBlockedHotTitle(item.title)).slice(0, 30);
  if (usable.length === 0) throw new Error("没有可保存的条目");
  const insert = db.prepare(
    "INSERT INTO hot_items (source, rank, title, heat, url, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const item of usable) insert.run(source, item.rank, item.title, item.heat, item.url, fetchedAt);
  return usable.length;
}

export function logHotFetch(db: DatabaseSync, source: string, ok: boolean, message: string, fetchedAt: string): void {
  db.prepare("INSERT INTO hot_fetch_log (source, ok, message, fetched_at) VALUES (?, ?, ?, ?)").run(
    source,
    ok ? 1 : 0,
    message.slice(0, 300),
    fetchedAt,
  );
}

export function pruneHot(db: DatabaseSync, now = new Date()): void {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM hot_items WHERE fetched_at < ?").run(cutoff);
  db.prepare("DELETE FROM hot_fetch_log WHERE fetched_at < ?").run(cutoff);
  db.prepare("DELETE FROM hot_pitches WHERE created_at < ?").run(cutoff);
}

export function listHotRows(db: DatabaseSync, source?: string): { rows: HotRow[]; updatedAt: string | null } {
  const sources = source ? [source] : HOT_ADAPTERS.map((item) => item.id);
  const rows: HotRow[] = [];
  let updatedAt: string | null = null;
  for (const id of sources) {
    const latest = db.prepare("SELECT MAX(fetched_at) AS value FROM hot_items WHERE source = ?").get(id);
    const fetchedAt = latest?.value ? String(latest.value) : "";
    if (!fetchedAt) continue;
    if (!updatedAt || fetchedAt > updatedAt) updatedAt = fetchedAt;
    const previous = db
      .prepare("SELECT MAX(fetched_at) AS value FROM hot_items WHERE source = ? AND fetched_at < ?")
      .get(id, fetchedAt);
    const prevAt = previous?.value ? String(previous.value) : "";
    const current = db.prepare("SELECT rank, title, heat, url FROM hot_items WHERE source = ? AND fetched_at = ? ORDER BY rank").all(id, fetchedAt);
    const prevRanks = new Map<string, number>();
    if (prevAt) {
      for (const item of db.prepare("SELECT rank, title FROM hot_items WHERE source = ? AND fetched_at = ?").all(id, prevAt)) {
        prevRanks.set(String(item.title), Number(item.rank));
      }
    }
    for (const item of current) {
      const title = String(item.title);
      if (isBlockedHotTitle(title)) continue;
      const rank = Number(item.rank);
      rows.push({
        source: id,
        rank,
        title,
        heat: String(item.heat || ""),
        url: String(item.url || ""),
        fetchedAt,
        trend: rankTrend(rank, prevRanks.has(title) ? prevRanks.get(title)! : null),
        tags: relevanceTags(title),
      });
    }
  }
  return { rows, updatedAt };
}

export function sourceName(id: string): string {
  return sourceLabel(id);
}

export type ManualIdea = {
  id: number;
  title: string;
  platform: string;
  rank: number | null;
  heat: string;
  url: string;
  fetchedAt: string;
  industry: string;
  idea: string;
  hidden: boolean;
};

export function importHotIdeas(db: DatabaseSync, payload: unknown): { imported: number; skipped: number } {
  const list = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items) ? (payload as { items: unknown[] }).items : null;
  if (!list) throw new Error("JSON 需要是数组，或带 items 数组");
  let imported = 0;
  let skipped = 0;
  const insert = db.prepare(
    `INSERT INTO hot_manual (title, platform, rank, heat, url, fetched_at, industry, idea, hidden)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  for (const item of list.slice(0, 50)) {
    if (!item || typeof item !== "object") {
      skipped += 1;
      continue;
    }
    const row = item as Record<string, unknown>;
    const title = String(row.title || "").trim();
    if (!title || isBlockedHotTitle(title)) {
      skipped += 1;
      continue;
    }
    const heat = row.heat == null ? "" : String(row.heat).slice(0, 40);
    const rank = row.rank == null || row.rank === "" ? null : Number(row.rank);
    insert.run(
      title.slice(0, 80),
      String(row.platform || "").slice(0, 20),
      rank != null && Number.isFinite(rank) ? Math.round(rank) : null,
      heat,
      String(row.url || "").slice(0, 300),
      String(row.fetched_at || new Date().toISOString()).slice(0, 40),
      String(row.industry || "").slice(0, 20),
      String(row.idea || "").slice(0, 200),
    );
    imported += 1;
  }
  if (imported === 0) throw new Error("没有可导入的条目");
  return { imported, skipped };
}

export function listManualIdeas(db: DatabaseSync): ManualIdea[] {
  return db
    .prepare("SELECT * FROM hot_manual WHERE hidden = 0 ORDER BY id DESC LIMIT 30")
    .all()
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      platform: String(row.platform || ""),
      rank: row.rank == null ? null : Number(row.rank),
      heat: String(row.heat || ""),
      url: String(row.url || ""),
      fetchedAt: String(row.fetched_at),
      industry: String(row.industry || ""),
      idea: String(row.idea || ""),
      hidden: Number(row.hidden) === 1,
    }))
    .filter((item) => !isBlockedHotTitle(item.title));
}

export function ideaForTitle(ideas: ManualIdea[], title: string): string {
  return ideas.find((item) => item.title === title)?.idea || "";
}

export function hideManualIdea(db: DatabaseSync, id: number): void {
  db.prepare("UPDATE hot_manual SET hidden = 1 WHERE id = ?").run(id);
}

export function isSolemnToday(db: DatabaseSync, today = todayShanghai()): boolean {
  const row = db
    .prepare(
      `SELECT id FROM calendar_events
       WHERE (event_type = 'solemn' OR title LIKE '%公祭%' OR caution LIKE '%不做营销%')
         AND start_date IS NOT NULL AND start_date <= ? AND COALESCE(end_date, start_date) >= ?
       LIMIT 1`,
    )
    .get(today, today);
  return Boolean(row);
}

export async function refreshHotLists(
  db: DatabaseSync,
  options: { fetchText?: (url: string) => Promise<string>; now?: Date } = {},
): Promise<void> {
  if (!hotEnabled()) return;
  const fetchText = options.fetchText ?? fetchHotText;
  const now = options.now ?? new Date();
  const fetchedAt = now.toISOString();
  for (const adapter of HOT_ADAPTERS) {
    try {
      const text = await fetchText(adapter.url);
      const parsed = adapter.parse(JSON.parse(text));
      const count = saveHotSnapshot(db, adapter.id, parsed, fetchedAt);
      logHotFetch(db, adapter.id, true, `保存 ${count} 条`, fetchedAt);
    } catch (error) {
      const message = error instanceof Error ? error.message : "抓取失败";
      logHotFetch(db, adapter.id, false, message, fetchedAt);
      console.error(`热点 ${adapter.label} 抓取失败：${message}`);
    }
  }
  pruneHot(db, now);
  if (!aiEnabled() || isSolemnToday(db, todayShanghai(now))) return;
  await draftHotPitches(db);
}

export async function draftHotPitches(db: DatabaseSync): Promise<number> {
  const { rows } = listHotRows(db);
  const picked = rows.filter((row) => row.tags.length > 0).slice(0, 4);
  if (picked.length === 0) return 0;
  const raw = await completeChat({
    timeoutMs: 30000,
    messages: [
      { role: "system", content: `${COPYWRITER_RULES}\n只根据热榜标题写原创的门店选题，不要复述新闻细节，不要引用原文。只返回 JSON。` },
      {
        role: "user",
        content: `热榜标题：${picked.map((row) => `${row.source}｜${row.title}｜${row.tags.join("/")}`).join("；")}。每条写 1 到 2 个蹭热点选题，字段 title、hook、platform、angle、industry、hotTitle。industry 只能是餐饮、美业、本地生活。`,
      },
    ],
  });
  const start = raw.indexOf("[") >= 0 ? raw.indexOf("[") : raw.indexOf("{");
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (start < 0 || end <= start) return 0;
  const parsed = JSON.parse(raw.slice(start, end + 1)) as { pitches?: unknown[] } | unknown[];
  const list = Array.isArray(parsed) ? parsed : parsed.pitches || [];
  let saved = 0;
  for (const item of list.slice(0, 8)) {
    const row = asRecord(item);
    if (!row) continue;
    const title = String(row.title || "").trim();
    const hotTitle = String(row.hotTitle || "").trim();
    if (!title || !hotTitle || isBlockedHotTitle(hotTitle) || isBlockedHotTitle(title)) continue;
    const exists = db.prepare("SELECT id FROM hot_pitches WHERE hot_title = ? AND title = ?").get(hotTitle, title);
    if (exists) continue;
    const sourceRow = picked.find((candidate) => candidate.title === hotTitle);
    db.prepare(
      `INSERT INTO hot_pitches (hot_title, source, source_url, industry, title, hook, platform, angle, hidden, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(
      hotTitle,
      sourceRow?.source || String(row.source || ""),
      sourceRow?.url || "",
      String(row.industry || sourceRow?.tags[0] || "本地生活"),
      title,
      String(row.hook || "").slice(0, 200),
      String(row.platform || "抖音"),
      String(row.angle || "").slice(0, 200),
      new Date().toISOString(),
    );
    saved += 1;
  }
  return saved;
}

export function listHotPitches(db: DatabaseSync, includeHidden = false): Array<Record<string, unknown>> {
  const sql = includeHidden
    ? "SELECT * FROM hot_pitches ORDER BY id DESC LIMIT 50"
    : "SELECT * FROM hot_pitches WHERE hidden = 0 ORDER BY id DESC LIMIT 20";
  return db.prepare(sql).all();
}

export function hideHotPitch(db: DatabaseSync, id: number): void {
  db.prepare("UPDATE hot_pitches SET hidden = 1 WHERE id = ?").run(id);
}

export function formatShanghaiClock(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

let schedulerStarted = false;

export function startHotScheduler(): void {
  if (schedulerStarted || !hotEnabled() || process.env.HOT_INPROCESS === "false") return;
  schedulerStarted = true;
  const run = () => {
    import("./db")
      .then(({ getDb }) => refreshHotLists(getDb()))
      .catch((error: unknown) => {
        console.error("热点任务失败", error instanceof Error ? error.message : "");
      });
  };
  setTimeout(run, 20000).unref();
  setInterval(run, hotRefreshMinutes() * 60 * 1000).unref();
}
