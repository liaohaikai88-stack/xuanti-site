import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { canReadTopic, hasFullAccess, splitPreview } from "../src/lib/access.ts";
import { activateOrder, createMembershipOrder, getPaymentProvider } from "../src/lib/billing.ts";
import { assignCalendarYears, inferCalendarYear, parseCnDateLabel } from "../src/lib/cn-date.ts";
import { parseCalendarCsv } from "../src/lib/calendar-csv.ts";
import { canonicalUrl, siteDomain } from "../src/lib/config.ts";
import { importCalendarCsv, importTopicCsv, listCautionEvents, listEvents, listTopics } from "../src/lib/content.ts";
import { parseTopicCsv } from "../src/lib/csv.ts";
import { migrate, openDatabase } from "../src/lib/db.ts";
import { readFileSync } from "node:fs";
import { templateCopy } from "../src/lib/llm.ts";
import { authenticate, registerUser } from "../src/lib/auth.ts";
import { createTopic } from "../src/lib/content.ts";
import { planRealTopics, seedIfEmpty } from "../src/lib/seed.ts";
import { getSmsSender } from "../src/lib/sms.ts";

process.env.SCRYPT_N = "1024";

function freshDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "xuanti-"));
  const db = openDatabase(path.join(dir, "app.db"));
  migrate(db);
  return db;
}

test("chinese calendar labels and year rollover", () => {
  assert.equal(inferCalendarYear("2026-11-16"), 2026);
  assert.equal(parseCnDateLabel("12月13日", 2026).startDate, "2026-12-13");
  assert.deepEqual(parseCnDateLabel("12月1日起", 2026), {
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    month: 12,
  });
  assert.equal(parseCnDateLabel("12月24日-25日", 2026).startDate, "2026-12-24");
  assert.equal(parseCnDateLabel("12月24日-25日", 2026).endDate, "2026-12-25");
  const labels = ["12月31日", "1月1日"];
  const parsed = assignCalendarYears(labels, 2026);
  assert.equal(parsed[1].startDate, "2027-01-01");
});

test("real topic and december calendar seeds", () => {
  const topics = parseTopicCsv(readFileSync("data/seed/topics.csv", "utf8"));
  assert.equal(topics.errors.length, 0);
  assert.equal(topics.rows.length, 30);
  const planned = planRealTopics(topics.rows, "2026-11-16");
  const today = planned.filter((item) => item.publishDate === "2026-11-16");
  assert.equal(today.length, 10);
  assert.equal(new Set(planned.map((item) => item.title)).size, 30);
  assert.equal(new Set(today.map((item) => item.title)).size, 10);
  assert.ok(new Set(today.slice(0, 4).map((item) => item.industry)).size >= 2);

  const calendar = parseCalendarCsv(readFileSync("data/seed/calendar.csv", "utf8"));
  assert.equal(calendar.rows.length, 8);
  const memorial = calendar.rows.find((row) => row.title === "国家公祭日");
  assert.ok(memorial);
  assert.equal(memorial?.caution, "当天不做营销和娱乐内容");
  assert.equal(memorial?.directions.length, 0);

  const db = freshDb();
  seedIfEmpty(db, { today: "2026-11-16", seedDir: "data/seed" });
  const seededToday = listTopics(db, { date: "2026-11-16" });
  assert.equal(seededToday.length, 10);
  assert.equal(new Set(seededToday.map((topic) => topic.title)).size, 10);
  assert.equal(seededToday.filter((topic) => topic.isSample).length, 0);
  assert.equal(seededToday.filter((topic) => topic.contentForm.length > 0).length, 10);
  const samples = listTopics(db, { date: "2026-11-13" });
  assert.equal(samples.filter((topic) => topic.isSample).length, 4);

  const events = listEvents(db);
  assert.equal(events.length, 8);
  assert.equal(events.filter((event) => event.isSample).length, 0);
  const day = events.find((event) => event.title === "国家公祭日");
  assert.equal(day?.startDate, "2026-12-13");
  assert.equal(day?.eventType, "solemn");
  assert.equal(day?.directions.length, 0);
  assert.equal(listCautionEvents(db).length, 1);
  const season = events.find((event) => event.title === "年底冲刺季");
  assert.equal(season?.startDate, "2026-12-01");
  assert.equal(season?.prepLabel, "11月底");
  assert.ok(season?.directions.some((item) => item.industryName === "餐饮" && item.direction.includes("年终聚餐")));

  const legal = db.prepare("SELECT content FROM legal_docs WHERE slug = 'terms'").get();
  const privacy = db.prepare("SELECT content FROM legal_docs WHERE slug = 'privacy'").get();
  assert.match(String(legal?.content), /今天拍啥/);
  assert.match(String(legal?.content), /【运营方名称】/);
  assert.match(String(legal?.content), /【联系邮箱】/);
  assert.match(String(privacy?.content), /今天拍啥/);
  assert.match(String(privacy?.content), /【联系邮箱】/);
  db.close();
});

test("anonymous preview, login unlocks content, billing stays behind the flag", async () => {
  const db = freshDb();
  seedIfEmpty(db, { today: "2026-11-16", seedDir: "data/seed" });
  const today = listTopics(db, { date: "2026-11-16" });
  process.env.MEMBERSHIP_BILLING_ENABLED = "false";
  process.env.FREE_PREVIEW_COUNT = "4";
  const preview = splitPreview(today, null);
  assert.equal(preview.visible.length, 4);
  assert.equal(preview.lockedCount, 6);
  assert.equal(canReadTopic(today[4], today, null, "2026-11-16"), false);
  assert.equal(canReadTopic(today[0], today, null, "2026-11-16"), true);

  const denied = await registerUser(db, {
    username: "店长",
    email: "boss@example.com",
    password: "secret-pass",
    passwordAgain: "secret-pass",
    consent: false,
  });
  assert.equal(denied.ok, false);

  const created = await registerUser(db, {
    username: "店长",
    email: "boss@example.com",
    password: "secret-pass",
    passwordAgain: "secret-pass",
    consent: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(hasFullAccess(created.user), true);
  assert.equal(canReadTopic(today[4], today, created.user, "2026-11-16"), true);

  const login = await authenticate(db, "boss@example.com", "secret-pass", "test");
  assert.equal(login.ok, true);

  process.env.MEMBERSHIP_BILLING_ENABLED = "true";
  assert.equal(hasFullAccess(created.user), false);
  const admin = await registerUser(db, {
    username: "编辑",
    email: "editor@example.com",
    password: "secret-pass",
    passwordAgain: "secret-pass",
    consent: true,
  });
  assert.equal(admin.ok, true);
  if (!admin.ok) return;
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(admin.user.id);
  const order = createMembershipOrder(db, created.user.id);
  assert.equal(order.order.status, "pending");
  assert.match(order.message, /管理员/);
  const paid = activateOrder(db, order.order.orderNo, admin.user.id);
  assert.equal(paid.status, "paid");
  const upgraded = db.prepare("SELECT * FROM users WHERE id = ?").get(created.user.id);
  assert.equal(upgraded?.tier, "annual");
  assert.equal(
    hasFullAccess({
      id: created.user.id,
      role: "user",
      tier: "annual",
      membershipExpiresAt: String(upgraded?.membership_expires_at),
    }),
    true,
  );
  process.env.MEMBERSHIP_BILLING_ENABLED = "false";
  db.close();
});

test("admin can add a topic and import csv files", () => {
  const db = freshDb();
  seedIfEmpty(db, { today: "2026-11-16", seedDir: "data/seed" });
  const industry = db.prepare("SELECT id FROM industries WHERE name = '餐饮'").get();
  const created = createTopic(db, {
    industryId: Number(industry?.id),
    title: "后台新加的一条",
    hook: "今天只拍这一口",
    platform: "抖音",
    contentForm: "口播",
    publishDate: "2026-11-16",
    status: "published",
  });
  assert.equal(listTopics(db, { date: "2026-11-16" }).some((topic) => topic.id === created.id), true);

  const imported = importTopicCsv(
    db,
    "行业,选题标题,开头钩子,适合平台,内容形式\n餐饮,导入的早餐,先闻再拍,抖音,实拍\n",
    { defaultDate: "2026-11-17", isSample: false },
  );
  assert.equal(imported.imported, 1);
  const again = importTopicCsv(
    db,
    "行业,选题标题,开头钩子,适合平台,内容形式\n餐饮,导入的早餐,先闻再拍,抖音,实拍\n",
    { defaultDate: "2026-11-17", isSample: false },
  );
  assert.equal(again.skipped, 1);

  const calendar = importCalendarCsv(db, "日期,节点,建议提前准备,餐饮选题方向,美业选题方向,本地生活选题方向,注意事项\n12月13日,国家公祭日,—,—,—,—,当天不做营销和娱乐内容\n", {
    baseYear: 2026,
    isSample: false,
  });
  assert.equal(calendar.skipped, 1);
  db.close();
});

test("domain, copy fallback and sms hook", () => {
  const previousDomain = process.env.SITE_DOMAIN;
  const previousApp = process.env.APP_URL;
  delete process.env.SITE_DOMAIN;
  process.env.APP_URL = "http://localhost:3000";
  assert.equal(siteDomain(), "jintianpaisha.cn");
  assert.equal(canonicalUrl(), "https://jintianpaisha.cn");
  process.env.SITE_DOMAIN = "shop.example";
  assert.equal(siteDomain(), "shop.example");
  if (previousDomain == null) delete process.env.SITE_DOMAIN;
  else process.env.SITE_DOMAIN = previousDomain;
  if (previousApp == null) delete process.env.APP_URL;
  else process.env.APP_URL = previousApp;
  delete process.env.LLM_API_KEY;
  const copy = templateCopy({ product: "牛肉面", industry: "餐饮", platform: "抖音" });
  assert.equal(copy.titles.length, 3);
  assert.match(copy.titles[0], /牛肉面/);
  assert.equal(getSmsSender(), null);
  assert.equal(getPaymentProvider().id, "manual");
});
