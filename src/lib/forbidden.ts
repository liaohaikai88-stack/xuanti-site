import type { DatabaseSync } from "node:sqlite";
import { todayShanghai } from "./dates";

export type ForbiddenWord = { id: number; phrase: string; replacement: string; category: string };

export type ForbiddenHit = { phrase: string; replacement: string; index: number };

const SEED: Array<[string, string, string]> = [
  ["国家级", "正规", "绝对化"],
  ["顶级", "用心做", "绝对化"],
  ["唯一", "少见", "绝对化"],
  ["第一", "靠前", "绝对化"],
  ["最佳", "合适", "绝对化"],
  ["最好", "合适", "绝对化"],
  ["最", "很", "绝对化"],
  ["保证", "尽量", "绝对化"],
  ["根治", "护理", "功效"],
  ["治愈", "护理", "功效"],
  ["疗效", "体验", "功效"],
  ["药到病除", "护理", "功效"],
  ["祛斑", "皮肤护理", "功效"],
  ["抗衰老", "皮肤护理", "功效"],
  ["排毒", "清淡饮食", "功效"],
  ["瘦身", "轻食", "功效"],
  ["无副作用", "看个人情况", "功效"],
  ["一次见效", "多拍几条看看", "功效"],
  ["微信", "到店", "导流"],
  ["威信", "到店", "导流"],
  ["加微信", "到店", "导流"],
  ["加微", "到店", "导流"],
  ["加我", "到店", "导流"],
  ["私信我", "评论区见", "导流"],
  ["vx", "到店", "导流"],
  ["v信", "到店", "导流"],
];

export function ensureForbiddenWords(db: DatabaseSync): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO forbidden_words (phrase, replacement, category, enabled) VALUES (?, ?, ?, 1)",
  );
  for (const [phrase, replacement, category] of SEED) insert.run(phrase, replacement, category);
}

export function listForbiddenWords(db: DatabaseSync): ForbiddenWord[] {
  return db
    .prepare("SELECT id, phrase, replacement, category FROM forbidden_words WHERE enabled = 1 ORDER BY length(phrase) DESC, id")
    .all()
    .map((row) => ({
      id: Number(row.id),
      phrase: String(row.phrase),
      replacement: String(row.replacement || ""),
      category: String(row.category || ""),
    }));
}

export function addForbiddenWord(db: DatabaseSync, phrase: string, replacement: string, category: string): void {
  const cleaned = phrase.trim();
  if (cleaned.length < 1 || cleaned.length > 20) throw new Error("词条长度需要在 1 到 20 字");
  db.prepare(
    `INSERT INTO forbidden_words (phrase, replacement, category, enabled) VALUES (?, ?, ?, 1)
     ON CONFLICT(phrase) DO UPDATE SET replacement = excluded.replacement, category = excluded.category, enabled = 1`,
  ).run(cleaned, replacement.trim().slice(0, 20), category.trim().slice(0, 12) || "自定义");
}

export function disableForbiddenWord(db: DatabaseSync, id: number): void {
  db.prepare("UPDATE forbidden_words SET enabled = 0 WHERE id = ?").run(id);
}

export function findForbiddenHits(text: string, words: ForbiddenWord[]): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  const used: Array<[number, number]> = [];
  const ordered = [...words].sort((a, b) => b.phrase.length - a.phrase.length);
  for (const word of ordered) {
    if (!word.phrase) continue;
    const ascii = /[a-z]/i.test(word.phrase);
    const source = ascii ? text.toLowerCase() : text;
    const needle = ascii ? word.phrase.toLowerCase() : word.phrase;
    let from = 0;
    while (from < source.length) {
      const index = source.indexOf(needle, from);
      if (index < 0) break;
      const end = index + needle.length;
      const overlap = used.some(([start, stop]) => index < stop && end > start);
      if (!overlap) {
        hits.push({ phrase: text.slice(index, end), replacement: word.replacement, index });
        used.push([index, end]);
      }
      from = end;
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export type TextPiece = { text: string; hit: ForbiddenHit | null };

export function splitByHits(text: string, hits: ForbiddenHit[]): TextPiece[] {
  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.index < cursor) continue;
    if (hit.index > cursor) pieces.push({ text: text.slice(cursor, hit.index), hit: null });
    pieces.push({ text: text.slice(hit.index, hit.index + hit.phrase.length), hit });
    cursor = hit.index + hit.phrase.length;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), hit: null });
  return pieces;
}

export function usageCount(db: DatabaseSync, actorKey: string, tool: string, day = todayShanghai()): number {
  const row = db.prepare("SELECT count FROM tool_usage WHERE day = ? AND actor_key = ? AND tool = ?").get(day, actorKey, tool);
  return Number(row?.count ?? 0);
}

export function bumpUsage(db: DatabaseSync, actorKey: string, tool: string, day = todayShanghai()): void {
  db.prepare(
    `INSERT INTO tool_usage (day, actor_key, tool, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(day, actor_key, tool) DO UPDATE SET count = count + 1`,
  ).run(day, actorKey, tool);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  db.prepare("DELETE FROM tool_usage WHERE day < ?").run(cutoff);
}
