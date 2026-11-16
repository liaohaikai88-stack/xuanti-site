import type { DatabaseSync } from "node:sqlite";
import { assignCalendarYears, parseCnDateLabel } from "./cn-date";
import { parseCalendarCsv, inferEventType, isPlaceholder } from "./calendar-csv";
import { parseTopicCsv, type CsvTopicRow } from "./csv";
import { insertId, withTransaction } from "./db";
import { addDays, isIsoDate, shanghaiDayStartIso, todayShanghai } from "./dates";
import type {
  CalendarEvent,
  CaseStudy,
  EventType,
  Industry,
  LegalDoc,
  Topic,
  TopicInput,
  TopicStatus,
} from "./types";

const INDUSTRY_PRESETS: Record<string, { slug: string; color: string; description: string }> = {
  餐饮: { slug: "canyin", color: "#FF6A2A", description: "餐厅、奶茶、烘焙、小吃" },
  美业: { slug: "meiye", color: "#FF4D88", description: "美容、美发、美甲、皮肤管理" },
  本地生活: { slug: "bendi", color: "#12A37A", description: "探店、城市生活、到店服务" },
};

const EXTRA_COLORS = ["#5B6CFF", "#F5A524", "#7C5CFF", "#E85D4C", "#0F8FBF"];

export function industryPreset(name: string): { slug: string; color: string; description: string } {
  if (INDUSTRY_PRESETS[name]) return INDUSTRY_PRESETS[name];
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return {
    slug: `hangye-${hash.toString(16).slice(0, 6)}`,
    color: EXTRA_COLORS[hash % EXTRA_COLORS.length],
    description: "",
  };
}

function mapIndustry(row: Record<string, unknown>): Industry {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    color: String(row.color),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapTopic(row: Record<string, unknown>): Topic {
  return {
    id: Number(row.id),
    industryId: Number(row.industry_id),
    industryName: String(row.industry_name),
    industrySlug: String(row.industry_slug),
    industryColor: String(row.industry_color),
    title: String(row.title),
    hook: String(row.hook),
    platform: String(row.platform),
    contentForm: String(row.content_form),
    publishDate: String(row.publish_date),
    sortOrder: Number(row.sort_order ?? 0),
    note: String(row.note ?? ""),
    isSample: Number(row.is_sample) === 1,
    status: row.status === "draft" ? "draft" : "published",
  };
}

const TOPIC_SELECT = `
  SELECT t.*, i.name AS industry_name, i.slug AS industry_slug, i.color AS industry_color
  FROM topics t JOIN industries i ON i.id = t.industry_id
`;

function mapEventBase(row: Record<string, unknown>): CalendarEvent {
  return {
    id: Number(row.id),
    dateLabel: String(row.date_label),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    title: String(row.title),
    prepLabel: String(row.prep_label ?? ""),
    caution: String(row.caution ?? ""),
    summary: String(row.summary ?? ""),
    detail: String(row.detail ?? ""),
    eventType: row.event_type as EventType,
    isSample: Number(row.is_sample) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    directions: [],
  };
}

function attachDirections(db: DatabaseSync, events: CalendarEvent[]): CalendarEvent[] {
  if (events.length === 0) return events;
  const ids = events.map((event) => event.id);
  const rows = db
    .prepare(
      `SELECT event_id, industry_name, direction FROM calendar_directions
       WHERE event_id IN (${ids.map(() => "?").join(",")}) ORDER BY id`,
    )
    .all(...ids);
  const grouped = new Map<number, CalendarEvent["directions"]>();
  for (const row of rows) {
    const id = Number(row.event_id);
    const list = grouped.get(id) ?? [];
    list.push({ industryName: String(row.industry_name), direction: String(row.direction) });
    grouped.set(id, list);
  }
  return events.map((event) => ({ ...event, directions: grouped.get(event.id) ?? [] }));
}

function mapCase(row: Record<string, unknown>): CaseStudy {
  return {
    id: Number(row.id),
    title: String(row.title),
    platform: String(row.platform),
    industryId: row.industry_id == null ? null : Number(row.industry_id),
    industryName: row.industry_name ? String(row.industry_name) : null,
    industryColor: row.industry_color ? String(row.industry_color) : null,
    teaser: String(row.teaser),
    body: String(row.body),
    publishedAt: String(row.published_at),
    isSample: Number(row.is_sample) === 1,
  };
}

export function listIndustries(db: DatabaseSync): Industry[] {
  return db.prepare("SELECT * FROM industries ORDER BY sort_order, id").all().map(mapIndustry);
}

export function getIndustryBySlug(db: DatabaseSync, slug: string): Industry | null {
  const row = db.prepare("SELECT * FROM industries WHERE slug = ?").get(slug);
  return row ? mapIndustry(row) : null;
}

export function getIndustryByName(db: DatabaseSync, name: string): Industry | null {
  const row = db.prepare("SELECT * FROM industries WHERE name = ?").get(name);
  return row ? mapIndustry(row) : null;
}

export function ensureIndustry(db: DatabaseSync, name: string): Industry {
  const existing = getIndustryByName(db, name);
  if (existing) return existing;
  const preset = industryPreset(name);
  let slug = preset.slug;
  let n = 2;
  while (db.prepare("SELECT id FROM industries WHERE slug = ?").get(slug)) {
    slug = `${preset.slug}-${n}`;
    n += 1;
  }
  const maxSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM industries").get();
  const result = db
    .prepare(
      `INSERT INTO industries (slug, name, color, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(slug, name, preset.color, preset.description, Number(maxSort?.value ?? 0) + 1, new Date().toISOString());
  return getIndustryByName(db, name) ?? mapIndustry({ id: insertId(result), slug, name, color: preset.color, description: preset.description, sort_order: 0 });
}

export function createIndustry(
  db: DatabaseSync,
  input: { name: string; slug: string; color: string; description: string; sortOrder: number },
): Industry {
  const name = input.name.trim();
  const slug = input.slug.trim() || industryPreset(name).slug;
  if (!name) throw new Error("请填写行业名称");
  if (!/^[\p{L}\p{N}-]+$/u.test(slug)) throw new Error("行业别名只能包含字母、数字、中文和连字符");
  db.prepare(
    `INSERT INTO industries (slug, name, color, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(slug, name, input.color || "#FF4F17", input.description.trim(), input.sortOrder || 0, new Date().toISOString());
  const created = getIndustryBySlug(db, slug);
  if (!created) throw new Error("行业创建失败");
  return created;
}

export function updateIndustry(
  db: DatabaseSync,
  id: number,
  input: { name: string; slug: string; color: string; description: string; sortOrder: number },
): void {
  db.prepare(
    `UPDATE industries SET name = ?, slug = ?, color = ?, description = ?, sort_order = ? WHERE id = ?`,
  ).run(input.name.trim(), input.slug.trim(), input.color, input.description.trim(), input.sortOrder || 0, id);
}

export function deleteIndustry(db: DatabaseSync, id: number): void {
  const used = db.prepare("SELECT COUNT(*) AS count FROM topics WHERE industry_id = ?").get(id);
  if (Number(used?.count ?? 0) > 0) throw new Error("这个行业下面还有选题，不能删除");
  db.prepare("DELETE FROM industries WHERE id = ?").run(id);
}

export function listTopics(
  db: DatabaseSync,
  filter: { date?: string; industrySlug?: string; query?: string; includeDrafts?: boolean; limit?: number } = {},
): Topic[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (!filter.includeDrafts) where.push("t.status = 'published'");
  if (filter.date) {
    where.push("t.publish_date = ?");
    params.push(filter.date);
  }
  if (filter.industrySlug) {
    where.push("i.slug = ?");
    params.push(filter.industrySlug);
  }
  if (filter.query) {
    const like = `%${filter.query.replace(/[\\%_]/g, "\\$&")}%`;
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.hook LIKE ? ESCAPE '\\' OR t.content_form LIKE ? ESCAPE '\\' OR i.name LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like);
  }
  const limit = filter.limit ?? 200;
  const sql = `${TOPIC_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.publish_date DESC, t.sort_order, t.id LIMIT ?`;
  return db.prepare(sql).all(...params, limit).map(mapTopic);
}

export function listTopicDates(db: DatabaseSync): string[] {
  return db
    .prepare("SELECT DISTINCT publish_date FROM topics WHERE status = 'published' ORDER BY publish_date DESC")
    .all()
    .map((row) => String(row.publish_date));
}

export function getTopic(db: DatabaseSync, id: number): Topic | null {
  const row = db.prepare(`${TOPIC_SELECT} WHERE t.id = ?`).get(id);
  return row ? mapTopic(row) : null;
}

export function nextSortOrder(db: DatabaseSync, publishDate: string): number {
  const row = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM topics WHERE publish_date = ?").get(publishDate);
  return Number(row?.value ?? 0) + 1;
}

function assertTopicInput(db: DatabaseSync, input: TopicInput): TopicInput {
  const title = input.title.trim();
  const hook = input.hook.trim();
  const platform = input.platform.trim();
  const contentForm = input.contentForm.trim();
  if (!title || !hook || !platform || !contentForm) throw new Error("标题、开头钩子、平台和内容形式都要填");
  if (title.length > 80 || hook.length > 300) throw new Error("标题或钩子太长了");
  if (!isIsoDate(input.publishDate)) throw new Error("发布日期格式应为 YYYY-MM-DD");
  const industry = db.prepare("SELECT id FROM industries WHERE id = ?").get(input.industryId);
  if (!industry) throw new Error("请选择行业");
  return { ...input, title, hook, platform, contentForm, note: (input.note ?? "").trim() };
}

export function createTopic(db: DatabaseSync, input: TopicInput): Topic {
  const value = assertTopicInput(db, input);
  const now = new Date().toISOString();
  const sortOrder = value.sortOrder && value.sortOrder > 0 ? value.sortOrder : nextSortOrder(db, value.publishDate);
  const result = db
    .prepare(
      `INSERT INTO topics (industry_id, title, hook, platform, content_form, publish_date, sort_order, note, is_sample, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      value.industryId,
      value.title,
      value.hook,
      value.platform,
      value.contentForm,
      value.publishDate,
      sortOrder,
      value.note ?? "",
      value.isSample ? 1 : 0,
      value.status ?? "published",
      now,
      now,
    );
  const topic = getTopic(db, insertId(result));
  if (!topic) throw new Error("选题保存失败");
  return topic;
}

export function updateTopic(db: DatabaseSync, id: number, input: TopicInput): void {
  const value = assertTopicInput(db, input);
  db.prepare(
    `UPDATE topics SET industry_id = ?, title = ?, hook = ?, platform = ?, content_form = ?, publish_date = ?,
     sort_order = ?, note = ?, is_sample = ?, status = ?, updated_at = ? WHERE id = ?`,
  ).run(
    value.industryId,
    value.title,
    value.hook,
    value.platform,
    value.contentForm,
    value.publishDate,
    value.sortOrder ?? 0,
    value.note ?? "",
    value.isSample ? 1 : 0,
    value.status ?? "published",
    new Date().toISOString(),
    id,
  );
}

export function deleteTopic(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM topics WHERE id = ?").run(id);
}

export function findTopicByTitle(db: DatabaseSync, title: string): Topic | null {
  const row = db.prepare(`${TOPIC_SELECT} WHERE t.title = ?`).get(title);
  return row ? mapTopic(row) : null;
}

export function importTopicRows(
  db: DatabaseSync,
  rows: CsvTopicRow[],
  options: { defaultDate: string; isSample: boolean },
): { imported: number; skipped: number; errors: string[] } {
  if (!isIsoDate(options.defaultDate)) return { imported: 0, skipped: 0, errors: ["默认发布日期不正确"] };
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  withTransaction(db, () => {
    for (const row of rows) {
      if (findTopicByTitle(db, row.title)) {
        skipped += 1;
        continue;
      }
      const date = row.publishDate || options.defaultDate;
      if (!isIsoDate(date)) {
        errors.push(`第 ${row.line} 行日期不正确`);
        continue;
      }
      const industry = ensureIndustry(db, row.industry);
      createTopic(db, {
        industryId: industry.id,
        title: row.title,
        hook: row.hook,
        platform: row.platform,
        contentForm: row.contentForm,
        publishDate: date,
        sortOrder: row.sortOrder,
        isSample: options.isSample,
        status: "published",
      });
      imported += 1;
    }
  });
  return { imported, skipped, errors };
}

export function importTopicCsv(
  db: DatabaseSync,
  text: string,
  options: { defaultDate: string; isSample: boolean },
): { imported: number; skipped: number; errors: string[] } {
  const parsed = parseTopicCsv(text);
  if (parsed.rows.length === 0 && parsed.errors.length > 0) return { imported: 0, skipped: 0, errors: parsed.errors };
  const result = importTopicRows(db, parsed.rows, options);
  return { ...result, errors: [...parsed.errors, ...result.errors] };
}

export function listEvents(db: DatabaseSync): CalendarEvent[] {
  const rows = db.prepare("SELECT * FROM calendar_events ORDER BY COALESCE(start_date, '9999-99-99'), sort_order, id").all();
  return attachDirections(db, rows.map(mapEventBase));
}

export function listCautionEvents(db: DatabaseSync): CalendarEvent[] {
  return listEvents(db).filter((event) => event.caution.trim().length > 0);
}

/** Homepage notice only from 3 days before the date through the date itself. */
export function cautionVisibleOnHome(
  event: { caution: string; startDate: string | null; endDate: string | null },
  today: string,
): boolean {
  if (!event.caution.trim() || !event.startDate) return false;
  const from = addDays(event.startDate, -3);
  const until = event.endDate && event.endDate >= event.startDate ? event.endDate : event.startDate;
  return today >= from && today <= until;
}

export function listEventsForMonth(db: DatabaseSync, month: string): CalendarEvent[] {
  const start = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const end = `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}`;
  const rows = db
    .prepare(
      `SELECT * FROM calendar_events
       WHERE start_date IS NOT NULL AND start_date <= ? AND COALESCE(end_date, start_date) >= ?
       ORDER BY start_date, sort_order, id`,
    )
    .all(end, start);
  return attachDirections(db, rows.map(mapEventBase));
}

export function getEvent(db: DatabaseSync, id: number): CalendarEvent | null {
  const row = db.prepare("SELECT * FROM calendar_events WHERE id = ?").get(id);
  if (!row) return null;
  return attachDirections(db, [mapEventBase(row)])[0];
}

export type EventInput = {
  dateLabel: string;
  startDate?: string | null;
  endDate?: string | null;
  title: string;
  prepLabel?: string;
  caution?: string;
  summary?: string;
  detail?: string;
  eventType?: EventType;
  isSample?: boolean;
  sortOrder?: number;
  directions: Array<{ industryName: string; direction: string }>;
};

function writeDirections(db: DatabaseSync, eventId: number, directions: EventInput["directions"]): void {
  db.prepare("DELETE FROM calendar_directions WHERE event_id = ?").run(eventId);
  const insert = db.prepare("INSERT INTO calendar_directions (event_id, industry_name, direction) VALUES (?, ?, ?)");
  for (const item of directions) {
    if (!item.industryName.trim() || isPlaceholder(item.direction)) continue;
    insert.run(eventId, item.industryName.trim(), item.direction.trim());
  }
}

export function createEvent(db: DatabaseSync, input: EventInput): CalendarEvent {
  if (!input.dateLabel.trim() || !input.title.trim()) throw new Error("日期和节点都要填");
  const startDate = input.startDate?.trim() || null;
  const endDate = input.endDate?.trim() || null;
  if (startDate && !isIsoDate(startDate)) throw new Error("开始日期格式应为 YYYY-MM-DD");
  if (endDate && !isIsoDate(endDate)) throw new Error("结束日期格式应为 YYYY-MM-DD");
  const now = new Date().toISOString();
  const eventType = input.eventType || inferEventType(input.title, input.caution ?? "");
  const result = db
    .prepare(
      `INSERT INTO calendar_events
       (date_label, start_date, end_date, title, prep_label, caution, summary, detail, event_type, is_sample, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.dateLabel.trim(),
      startDate,
      endDate,
      input.title.trim(),
      (input.prepLabel ?? "").trim(),
      (input.caution ?? "").trim(),
      (input.summary ?? "").trim(),
      (input.detail ?? "").trim(),
      eventType,
      input.isSample ? 1 : 0,
      input.sortOrder ?? 0,
      now,
    );
  const id = insertId(result);
  writeDirections(db, id, input.directions);
  const event = getEvent(db, id);
  if (!event) throw new Error("日历保存失败");
  return event;
}

export function updateEvent(db: DatabaseSync, id: number, input: EventInput): void {
  if (!getEvent(db, id)) throw new Error("找不到这条日历");
  const startDate = input.startDate?.trim() || null;
  const endDate = input.endDate?.trim() || null;
  db.prepare(
    `UPDATE calendar_events SET date_label = ?, start_date = ?, end_date = ?, title = ?, prep_label = ?, caution = ?,
     summary = ?, detail = ?, event_type = ?, is_sample = ?, sort_order = ? WHERE id = ?`,
  ).run(
    input.dateLabel.trim(),
    startDate,
    endDate,
    input.title.trim(),
    (input.prepLabel ?? "").trim(),
    (input.caution ?? "").trim(),
    (input.summary ?? "").trim(),
    (input.detail ?? "").trim(),
    input.eventType || inferEventType(input.title, input.caution ?? ""),
    input.isSample ? 1 : 0,
    input.sortOrder ?? 0,
    id,
  );
  writeDirections(db, id, input.directions);
}

export function deleteEvent(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM calendar_events WHERE id = ?").run(id);
}

export function importCalendarCsv(
  db: DatabaseSync,
  text: string,
  options: { baseYear: number; isSample: boolean },
): { imported: number; skipped: number; errors: string[] } {
  const parsed = parseCalendarCsv(text);
  if (parsed.rows.length === 0 && parsed.errors.length > 0) return { imported: 0, skipped: 0, errors: parsed.errors };
  const dated = assignCalendarYears(
    parsed.rows.map((row) => row.dateLabel),
    options.baseYear,
  );
  let imported = 0;
  let skipped = 0;
  const errors = [...parsed.errors];
  withTransaction(db, () => {
    parsed.rows.forEach((row, index) => {
      const duplicate = db
        .prepare("SELECT id FROM calendar_events WHERE date_label = ? AND title = ?")
        .get(row.dateLabel, row.title);
      if (duplicate) {
        skipped += 1;
        return;
      }
      const parsedDate = dated[index];
      if (!parsedDate?.startDate) errors.push(`第 ${row.line} 行的日期没能识别成具体日期，已按原文保存`);
      createEvent(db, {
        dateLabel: row.dateLabel,
        startDate: parsedDate?.startDate ?? null,
        endDate: parsedDate?.endDate ?? null,
        title: row.title,
        prepLabel: row.prepLabel,
        caution: row.caution,
        eventType: inferEventType(row.title, row.caution),
        isSample: options.isSample,
        sortOrder: index + 1,
        directions: row.directions,
      });
      imported += 1;
    });
  });
  return { imported, skipped, errors };
}

export function eventSpanDays(event: CalendarEvent): number | null {
  if (!event.startDate) return null;
  const end = event.endDate || event.startDate;
  const startUtc = Date.parse(`${event.startDate}T00:00:00Z`);
  const endUtc = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endUtc - startUtc) / 86400000) + 1;
}

export function eventCoversDay(event: CalendarEvent, isoDate: string): boolean {
  if (!event.startDate) return false;
  const end = event.endDate || event.startDate;
  return event.startDate <= isoDate && end >= isoDate && (eventSpanDays(event) ?? 99) <= 5;
}

const CASE_SELECT = `
  SELECT c.*, i.name AS industry_name, i.color AS industry_color
  FROM cases c LEFT JOIN industries i ON i.id = c.industry_id
`;

export function listCases(db: DatabaseSync): CaseStudy[] {
  return db.prepare(`${CASE_SELECT} ORDER BY published_at DESC, id DESC`).all().map(mapCase);
}

export function getCase(db: DatabaseSync, id: number): CaseStudy | null {
  const row = db.prepare(`${CASE_SELECT} WHERE c.id = ?`).get(id);
  return row ? mapCase(row) : null;
}

export function createCase(
  db: DatabaseSync,
  input: { title: string; platform: string; industryId: number | null; teaser: string; body: string; publishedAt: string; isSample: boolean },
): CaseStudy {
  if (!input.title.trim() || !input.teaser.trim() || !input.body.trim()) throw new Error("标题、预览和正文都要填");
  const result = db
    .prepare(
      `INSERT INTO cases (title, platform, industry_id, teaser, body, published_at, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title.trim(),
      input.platform.trim(),
      input.industryId,
      input.teaser.trim(),
      input.body.trim(),
      input.publishedAt,
      input.isSample ? 1 : 0,
      new Date().toISOString(),
    );
  const created = getCase(db, insertId(result));
  if (!created) throw new Error("拆解保存失败");
  return created;
}

export function updateCase(
  db: DatabaseSync,
  id: number,
  input: { title: string; platform: string; industryId: number | null; teaser: string; body: string; publishedAt: string; isSample: boolean },
): void {
  db.prepare(
    `UPDATE cases SET title = ?, platform = ?, industry_id = ?, teaser = ?, body = ?, published_at = ?, is_sample = ? WHERE id = ?`,
  ).run(input.title.trim(), input.platform.trim(), input.industryId, input.teaser.trim(), input.body.trim(), input.publishedAt, input.isSample ? 1 : 0, id);
}

export function deleteCase(db: DatabaseSync, id: number): void {
  db.prepare("DELETE FROM cases WHERE id = ?").run(id);
}

export function favoriteIdSet(db: DatabaseSync, userId: number): Set<number> {
  const rows = db.prepare("SELECT topic_id FROM favorites WHERE user_id = ?").all(userId);
  return new Set(rows.map((row) => Number(row.topic_id)));
}

export function listFavoriteTopics(db: DatabaseSync, userId: number): Topic[] {
  return db
    .prepare(
      `${TOPIC_SELECT}
       JOIN favorites f ON f.topic_id = t.id
       WHERE f.user_id = ? AND t.status = 'published'
       ORDER BY f.created_at DESC`,
    )
    .all(userId)
    .map(mapTopic);
}

export function toggleFavorite(db: DatabaseSync, userId: number, topicId: number): boolean {
  const existing = db.prepare("SELECT 1 AS ok FROM favorites WHERE user_id = ? AND topic_id = ?").get(userId, topicId);
  if (existing) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND topic_id = ?").run(userId, topicId);
    return false;
  }
  const topic = getTopic(db, topicId);
  if (!topic || topic.status !== "published") throw new Error("找不到这条选题");
  db.prepare("INSERT INTO favorites (user_id, topic_id, created_at) VALUES (?, ?, ?)").run(userId, topicId, new Date().toISOString());
  return true;
}

export function getLegal(db: DatabaseSync, slug: string): LegalDoc | null {
  const row = db.prepare("SELECT * FROM legal_docs WHERE slug = ?").get(slug);
  if (!row) return null;
  return { slug: String(row.slug), title: String(row.title), content: String(row.content), updatedAt: String(row.updated_at) };
}

export function saveLegal(db: DatabaseSync, slug: string, title: string, content: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO legal_docs (slug, title, content, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at`,
  ).run(slug, title.trim(), content, now);
}

export function stats(db: DatabaseSync): {
  users: number;
  usersToday: number;
  topics: number;
  topicsToday: number;
  cases: number;
  events: number;
  favorites: number;
  pendingOrders: number;
} {
  const count = (sql: string, ...params: Array<string | number>) => Number(db.prepare(sql).get(...params)?.count ?? 0);
  const today = todayShanghai();
  return {
    users: count("SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL"),
    usersToday: count("SELECT COUNT(*) AS count FROM users WHERE deleted_at IS NULL AND created_at >= ?", shanghaiDayStartIso(today)),
    topics: count("SELECT COUNT(*) AS count FROM topics WHERE status = 'published'"),
    topicsToday: count("SELECT COUNT(*) AS count FROM topics WHERE status = 'published' AND publish_date = ?", today),
    cases: count("SELECT COUNT(*) AS count FROM cases"),
    events: count("SELECT COUNT(*) AS count FROM calendar_events"),
    favorites: count("SELECT COUNT(*) AS count FROM favorites"),
    pendingOrders: count("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'"),
  };
}

export function topicCopyText(topic: { title: string; hook: string }): string {
  return `${topic.title}\n${topic.hook}`;
}

export function parseManualDate(label: string, year: number): { startDate: string | null; endDate: string | null } {
  return parseCnDateLabel(label, year);
}
