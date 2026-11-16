import type { DatabaseSync } from "node:sqlite";
import { parseCsv } from "./csv";

export type BenchmarkCase = {
  id: number;
  topicTitle: string;
  title: string;
  platform: string;
  likes: number | null;
  favorites: number | null;
  url: string;
  lookedUpAt: string;
};

export function benchmarkAsOf(lookedUpAt: string): string {
  return lookedUpAt.trim() ? `数据截至 ${lookedUpAt.trim()}` : "";
}

function mapRow(row: Record<string, unknown>): BenchmarkCase {
  return {
    id: Number(row.id),
    topicTitle: String(row.topic_title),
    title: String(row.benchmark_title),
    platform: String(row.platform || ""),
    likes: row.likes == null ? null : Number(row.likes),
    favorites: row.favorites == null ? null : Number(row.favorites),
    url: String(row.url || ""),
    lookedUpAt: String(row.looked_up_at || ""),
  };
}

export function listBenchmarks(db: DatabaseSync, topicTitle: string): BenchmarkCase[] {
  return db
    .prepare("SELECT * FROM benchmark_cases WHERE topic_title = ? ORDER BY id")
    .all(topicTitle)
    .map(mapRow);
}

function parseCount(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "").replace(/万$/, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(value.includes("万") ? parsed * 10000 : parsed);
}

export function importBenchmarkCsv(db: DatabaseSync, text: string): { imported: number; skipped: number; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { imported: 0, skipped: 0, errors: ["CSV 是空的"] };
  const header = table[0].map((cell) => cell.trim());
  const required = ["选题标题", "对标标题"];
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length > 0) return { imported: 0, skipped: 0, errors: [`缺少列：${missing.join("、")}`] };
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const insert = db.prepare(
    `INSERT INTO benchmark_cases (topic_title, benchmark_title, platform, likes, favorites, url, looked_up_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  table.slice(1).forEach((cells, index) => {
    const record: Record<string, string> = {};
    header.forEach((name, cellIndex) => {
      record[name] = (cells[cellIndex] ?? "").trim();
    });
    const line = index + 2;
    const topicTitle = record["选题标题"] || "";
    const title = record["对标标题"] || "";
    if (!topicTitle || !title) {
      skipped += 1;
      errors.push(`第 ${line} 行缺少选题标题或对标标题`);
      return;
    }
    if (topicTitle.length > 80 || title.length > 80) {
      skipped += 1;
      errors.push(`第 ${line} 行标题过长`);
      return;
    }
    const likes = parseCount(record["点赞"] || "");
    const favorites = parseCount(record["收藏"] || "");
    if ((record["点赞"] || "").trim() && likes == null) {
      skipped += 1;
      errors.push(`第 ${line} 行点赞不是数字`);
      return;
    }
    if ((record["收藏"] || "").trim() && favorites == null) {
      skipped += 1;
      errors.push(`第 ${line} 行收藏不是数字`);
      return;
    }
    insert.run(
      topicTitle,
      title,
      (record["平台"] || "").slice(0, 20),
      likes,
      favorites,
      (record["链接"] || "").slice(0, 300),
      (record["查找时间"] || "").slice(0, 40),
      new Date().toISOString(),
    );
    imported += 1;
  });
  return { imported, skipped, errors };
}

