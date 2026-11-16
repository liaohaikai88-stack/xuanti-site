import type { DatabaseSync } from "node:sqlite";
import { insertId } from "./db";
import { addDays, todayShanghai } from "./dates";
import { getUserById } from "./auth";
import { COPYWRITER_RULES, type ChatMessage } from "./ai-client";
import { activePlan, aiQuotaFor, canUseAi } from "./membership";
import { aiUsesToday } from "./rewrite";
import { findSensitive, SAFE_REPLY } from "./safety";

export type Conversation = {
  id: number;
  title: string;
  topicId: number | null;
  updatedAt: string;
};

const HISTORY_LIMIT = 8;

export function dayBounds(day = todayShanghai()): { start: string; end: string } {
  return {
    start: new Date(`${day}T00:00:00+08:00`).toISOString(),
    end: new Date(`${addDays(day, 1)}T00:00:00+08:00`).toISOString(),
  };
}

export function quotaFor(db: DatabaseSync, user: { id: number }): number {
  const loaded = getUserById(db, user.id);
  if (!loaded) return 0;
  return aiQuotaFor(db, loaded);
}

export function messagesUsedToday(db: DatabaseSync, userId: number, day = todayShanghai()): number {
  const bounds = dayBounds(day);
  return aiUsesToday(db, userId, bounds.start, bounds.end);
}

export function listConversations(db: DatabaseSync, userId: number): Conversation[] {
  return db
    .prepare(
      `SELECT id, title, topic_id, updated_at FROM ai_conversations
       WHERE user_id = ? ORDER BY updated_at DESC LIMIT 30`,
    )
    .all(userId)
    .map((row) => ({
      id: Number(row.id),
      title: String(row.title),
      topicId: row.topic_id == null ? null : Number(row.topic_id),
      updatedAt: String(row.updated_at),
    }));
}

export function getConversation(db: DatabaseSync, userId: number, id: number): Conversation | null {
  const row = db
    .prepare("SELECT id, title, topic_id, updated_at FROM ai_conversations WHERE id = ? AND user_id = ?")
    .get(id, userId);
  if (!row) return null;
  return {
    id: Number(row.id),
    title: String(row.title),
    topicId: row.topic_id == null ? null : Number(row.topic_id),
    updatedAt: String(row.updated_at),
  };
}

export function listMessages(db: DatabaseSync, conversationId: number): Array<{ role: "user" | "assistant"; content: string }> {
  return db
    .prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id")
    .all(conversationId)
    .map((row) => ({ role: row.role === "assistant" ? "assistant" : "user", content: String(row.content) }));
}

export function recentMessages(db: DatabaseSync, conversationId: number): ChatMessage[] {
  const rows = db
    .prepare("SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?")
    .all(conversationId, HISTORY_LIMIT)
    .reverse();
  return rows.map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: String(row.content).slice(0, 1200),
  }));
}

export function createConversation(db: DatabaseSync, userId: number, title: string, topicId: number | null): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO ai_conversations (user_id, topic_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(userId, topicId, title.slice(0, 40) || "新对话", now, now);
  return insertId(result);
}

export function addMessage(db: DatabaseSync, conversationId: number, role: "user" | "assistant", content: string): void {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)").run(
    conversationId,
    role,
    content.slice(0, 8000),
    now,
  );
  db.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
}

export function deleteConversation(db: DatabaseSync, userId: number, id: number): void {
  db.prepare("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?").run(id, userId);
}

export function assertCanSend(db: DatabaseSync, user: { id: number }): void {
  const loaded = getUserById(db, user.id);
  if (!loaded) throw new Error("请先登录");
  if (!canUseAi(loaded)) throw new Error("内测中，联系我们开通");
  const used = messagesUsedToday(db, loaded.id);
  const quota = aiQuotaFor(db, loaded);
  if (used >= quota) {
    const paid = activePlan(loaded) !== "free" || loaded.role === "admin";
    throw new Error(paid ? "今天的次数已经用完，明天再来。" : "今天的免费次数用完了。内测中，联系我们开通可获得更多次数。");
  }
}

export function screenInput(text: string): void {
  const hit = findSensitive(text);
  if (hit) throw new Error(`这句话里有不适合发布的说法（${hit}）。换成具体、不夸张的描述。`);
}

export function screenOutput(text: string): string {
  return findSensitive(text) ? SAFE_REPLY : text;
}

export function topicContext(topic: { title: string; hook: string; platform: string; contentForm: string; industryName: string } | null): string {
  if (!topic) return COPYWRITER_RULES;
  return `${COPYWRITER_RULES}
当前选题：${topic.title}
行业：${topic.industryName}
平台：${topic.platform}
拍法：${topic.contentForm}
开头钩子：${topic.hook}
用户如果说「用这个选题帮我写」，就围绕这条选题写，并可以追问店名和招牌。`;
}
