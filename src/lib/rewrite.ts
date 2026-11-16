import type { DatabaseSync } from "node:sqlite";
import { completeChat } from "./ai-client";
import { insertId } from "./db";
import { findForbiddenHits, listForbiddenWords, type ForbiddenHit } from "./forbidden";
import { aiQuotaFor, canUseAi } from "./membership";
import type { ShopProfile } from "./shop";
import type { Topic, User } from "./types";

export type RewriteResult = {
  id: number;
  script: string;
  storyboard: string;
  xhsTitle: string;
  xhsBody: string;
  xhsTags: string;
  hits: ForbiddenHit[];
};

const AI_LABEL = "AI 生成，仅供参考";

export function aiUsesToday(db: DatabaseSync, userId: number, startIso: string, endIso: string): number {
  const chats = db
    .prepare(
      `SELECT COUNT(*) AS count FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= ? AND m.created_at < ?`,
    )
    .get(userId, startIso, endIso);
  const rewrites = db
    .prepare("SELECT COUNT(*) AS count FROM ai_generations WHERE user_id = ? AND kind = 'rewrite' AND created_at >= ? AND created_at < ?")
    .get(userId, startIso, endIso);
  return Number(chats?.count ?? 0) + Number(rewrites?.count ?? 0);
}

export function latestRewrite(db: DatabaseSync, userId: number): RewriteResult | null {
  const row = db
    .prepare("SELECT id, output_text FROM ai_generations WHERE user_id = ? AND kind = 'rewrite' ORDER BY id DESC LIMIT 1")
    .get(userId);
  if (!row) return null;
  return present(db, Number(row.id), String(row.output_text));
}

function present(db: DatabaseSync, id: number, raw: string): RewriteResult {
  let parsed: Partial<RewriteResult> = {};
  try {
    parsed = JSON.parse(raw) as Partial<RewriteResult>;
  } catch {
    parsed = { script: raw };
  }
  const script = String(parsed.script || "");
  const storyboard = String(parsed.storyboard || "");
  const xhsTitle = String(parsed.xhsTitle || "");
  const xhsBody = String(parsed.xhsBody || "");
  const xhsTags = String(parsed.xhsTags || "");
  const hits = findForbiddenHits([script, storyboard, xhsTitle, xhsBody, xhsTags].join("\n"), listForbiddenWords(db));
  return { id, script, storyboard, xhsTitle, xhsBody, xhsTags, hits };
}

export async function rewriteForShop(
  db: DatabaseSync,
  user: User,
  topic: Topic,
  shop: ShopProfile,
  usedToday: number,
): Promise<RewriteResult> {
  if (!canUseAi(user)) throw new Error("内测中，联系我们开通");
  const quota = aiQuotaFor(db, user);
  if (usedToday >= quota) throw new Error("今天的改写次数已经用完，明天再来。");
  if (!shop.shopName.trim()) throw new Error("先把店名写上，再按你的店改写");
  const products = shop.products.filter(Boolean).join("、") || "招牌还没填";
  const prompt = `请只输出 JSON，不要 markdown。字段：script（口播稿）、storyboard（分镜，每行「镜头1 0-3秒 | 画面 | 台词 | 拍法」）、xhsTitle、xhsBody、xhsTags（话题用空格分隔，带 #）。
店名：${shop.shopName}
细分行业：${shop.subIndustryName || shop.industryName}
城市商圈：${shop.city} ${shop.district}
人均：${shop.avgSpend || "未填"}
招牌：${products}
卖点：${shop.sellingPoints || "未填"}
客人：${shop.audience || "未填"}
语气：${shop.tone}
老板出镜：${shop.ownerOnCamera ? "是" : "否"}
选题：${topic.title}
钩子：${topic.hook}
拍法：${topic.contentForm}
要求：用这家店的具体信息改写，不写绝对化用语，不承诺效果，不出现联系方式导流。`;
  const text = await completeChat({ messages: [{ role: "user", content: prompt }], timeoutMs: 35000 });
  const json = extractJson(text);
  const stored = JSON.stringify({
    script: clip(json.script, 1200),
    storyboard: clip(json.storyboard, 1200),
    xhsTitle: clip(json.xhsTitle, 40),
    xhsBody: clip(json.xhsBody, 800),
    xhsTags: clip(json.xhsTags, 120),
  });
  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO ai_generations (user_id, topic_id, kind, output_text, created_at) VALUES (?, ?, 'rewrite', ?, ?)")
    .run(user.id, topic.id, stored, now);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM ai_generations WHERE created_at < ?").run(cutoff);
  return present(db, insertId(result), stored);
}

function clip(value: unknown, max: number): string {
  return String(value || "").trim().slice(0, max);
}

function extractJson(text: string): Partial<RewriteResult> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Partial<RewriteResult>;
    } catch {
      /* fall through */
    }
  }
  return { script: text.trim() };
}

export { AI_LABEL };
