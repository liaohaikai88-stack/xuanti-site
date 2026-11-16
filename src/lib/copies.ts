import type { DatabaseSync } from "node:sqlite";
import { freeCopyCount } from "./config";
import { parseCsv } from "./csv";
import { insertId } from "./db";

export type BreakdownSection = { heading: string; text: string };

export type TopicCopy = {
  id: number;
  topicId: number;
  styleLabel: string;
  body: string;
  storyboard: string;
  breakdown: BreakdownSection[];
  status: "draft" | "published";
  sortOrder: number;
};

export type CopyInput = {
  topicId: number;
  styleLabel: string;
  body: string;
  storyboard?: string;
  breakdown: BreakdownSection[];
  status?: "draft" | "published";
  sortOrder?: number;
};

/** Turn "为什么这样写" into sections. Lines like `钩子：...` become headings; otherwise one block. */
export function parseWhy(text: string): BreakdownSection[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\s*\|\|\s*/g, "\n").trim();
  if (!normalized) return [];
  const sections: BreakdownSection[] = [];
  for (const line of normalized.split("\n").map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(/^([^:：]{1,16})[:：]\s*(.+)$/);
    if (match) sections.push({ heading: match[1].trim(), text: match[2].trim() });
    else sections.push({ heading: "为什么这样写", text: line });
  }
  return sections;
}

export function formatWhy(sections: BreakdownSection[]): string {
  return sections.map((section) => `${section.heading}：${section.text}`).join("\n");
}

function mapCopy(row: Record<string, unknown>): TopicCopy {
  let breakdown: BreakdownSection[] = [];
  try {
    const parsed = JSON.parse(String(row.breakdown_json || "[]")) as BreakdownSection[];
    if (Array.isArray(parsed)) {
      breakdown = parsed
        .map((section) => ({ heading: String(section.heading || "").trim(), text: String(section.text || "").trim() }))
        .filter((section) => section.heading && section.text);
    }
  } catch {
    breakdown = [];
  }
  return {
    id: Number(row.id),
    topicId: Number(row.topic_id),
    styleLabel: String(row.style_label),
    body: String(row.body),
    storyboard: String(row.storyboard || ""),
    breakdown,
    status: row.status === "draft" ? "draft" : "published",
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function listTopicCopies(db: DatabaseSync, topicId: number, includeDrafts = false): TopicCopy[] {
  const sql = includeDrafts
    ? "SELECT * FROM topic_copies WHERE topic_id = ? ORDER BY sort_order, id"
    : "SELECT * FROM topic_copies WHERE topic_id = ? AND status = 'published' ORDER BY sort_order, id";
  return db.prepare(sql).all(topicId).map(mapCopy);
}

export function splitCopiesForViewer<T>(copies: T[], unlockCount: number): { open: T[]; locked: T[] } {
  if (unlockCount < 0) return { open: copies, locked: [] };
  const count = Number.isFinite(unlockCount) ? Math.max(0, Math.floor(unlockCount)) : freeCopyCount();
  return { open: copies.slice(0, count), locked: copies.slice(count) };
}

export function copyCounts(db: DatabaseSync, topicIds: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  if (topicIds.length === 0) return counts;
  const rows = db
    .prepare(
      `SELECT topic_id, COUNT(*) AS count FROM topic_copies
       WHERE status = 'published' AND topic_id IN (${topicIds.map(() => "?").join(",")})
       GROUP BY topic_id`,
    )
    .all(...topicIds);
  for (const row of rows) counts.set(Number(row.topic_id), Number(row.count));
  return counts;
}

export function nextCopySort(db: DatabaseSync, topicId: number): number {
  const row = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM topic_copies WHERE topic_id = ?").get(topicId);
  return Number(row?.value ?? 0) + 1;
}

export function createTopicCopy(db: DatabaseSync, input: CopyInput): TopicCopy {
  const styleLabel = input.styleLabel.trim();
  const body = input.body.trim();
  if (!styleLabel || !body) throw new Error("文案风格和正文都要填");
  if (styleLabel.length > 40 || body.length > 4000) throw new Error("文案太长了");
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO topic_copies (topic_id, style_label, body, storyboard, breakdown_json, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.topicId,
      styleLabel,
      body,
      (input.storyboard || "").trim().slice(0, 4000),
      JSON.stringify(input.breakdown.slice(0, 8)),
      input.status ?? "published",
      input.sortOrder && input.sortOrder > 0 ? input.sortOrder : nextCopySort(db, input.topicId),
      now,
      now,
    );
  const created = db.prepare("SELECT * FROM topic_copies WHERE id = ?").get(insertId(result));
  if (!created) throw new Error("文案保存失败");
  return mapCopy(created);
}

export function updateTopicCopy(
  db: DatabaseSync,
  id: number,
  input: { styleLabel: string; body: string; storyboard?: string; breakdown: BreakdownSection[]; status: "draft" | "published"; sortOrder: number },
): void {
  db.prepare(
    `UPDATE topic_copies SET style_label = ?, body = ?, storyboard = ?, breakdown_json = ?, status = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
  ).run(
    input.styleLabel.trim(),
    input.body.trim(),
    (input.storyboard || "").trim().slice(0, 4000),
    JSON.stringify(input.breakdown.slice(0, 8)),
    input.status,
    input.sortOrder,
    new Date().toISOString(),
    id,
  );
}

export function deleteTopicCopy(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM topic_copies WHERE id = ?").run(id);
}

export type CopyCsvRow = {
  line: number;
  title: string;
  date?: string;
  styleLabel: string;
  body: string;
  why: string;
  storyboard: string;
};

export function parseCopyCsv(table: string[][]): { rows: CopyCsvRow[]; errors: string[] } {
  if (table.length === 0) return { rows: [], errors: ["CSV 是空的"] };
  const header = table[0].map((cell) => cell.trim());
  for (const name of ["选题标题", "文案风格", "文案正文", "为什么这样写"]) {
    if (!header.includes(name)) return { rows: [], errors: [`参考文案 CSV 缺少列：${name}`] };
  }
  const rows: CopyCsvRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const record = new Map<string, string>();
    header.forEach((name, cellIndex) => record.set(name, (cells[cellIndex] ?? "").trim()));
    const title = record.get("选题标题") ?? "";
    const styleLabel = record.get("文案风格") ?? "";
    const body = record.get("文案正文") ?? "";
    const why = record.get("为什么这样写") ?? "";
    const storyboard = record.get("分镜") ?? "";
    if (!title || !styleLabel || !body) {
      errors.push(`第 ${line} 行缺少选题标题、文案风格或文案正文`);
      return;
    }
    const date = record.get("发布日期") || record.get("日期") || undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`第 ${line} 行日期格式应为 YYYY-MM-DD`);
      return;
    }
    rows.push({ line, title, date, styleLabel, body, why, storyboard });
  });
  return { rows, errors };
}

export function importCopyCsv(db: DatabaseSync, text: string): { imported: number; skipped: number; errors: string[] } {
  const parsed = parseCopyCsv(parseCsv(text));
  if (parsed.rows.length === 0 && parsed.errors.length) return { imported: 0, skipped: 0, errors: parsed.errors };
  let imported = 0;
  let skipped = 0;
  const errors = [...parsed.errors];
  for (const row of parsed.rows) {
    const matches = row.date
      ? db.prepare("SELECT id FROM topics WHERE title = ? AND publish_date = ?").all(row.title, row.date)
      : db.prepare("SELECT id FROM topics WHERE title = ?").all(row.title);
    if (matches.length === 0) {
      errors.push(`第 ${row.line} 行找不到选题「${row.title}」`);
      continue;
    }
    for (const match of matches) {
      const topicId = Number(match.id);
      const exists = db
        .prepare("SELECT id FROM topic_copies WHERE topic_id = ? AND style_label = ? AND body = ?")
        .get(topicId, row.styleLabel, row.body);
      if (exists) {
        skipped += 1;
        continue;
      }
      createTopicCopy(db, {
        topicId,
        styleLabel: row.styleLabel,
        body: row.body,
        breakdown: parseWhy(row.why),
        storyboard: row.storyboard,
        status: "published",
      });
      imported += 1;
    }
  }
  return { imported, skipped, errors };
}
