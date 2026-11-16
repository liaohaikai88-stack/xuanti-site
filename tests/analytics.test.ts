import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  baiduTongjiSnippet,
  listDailyStats,
  recordVisit,
  shouldTrackPath,
  visitorHash,
} from "../src/lib/analytics.ts";
import { casesEnabled } from "../src/lib/config.ts";
import { cautionVisibleOnHome } from "../src/lib/content.ts";
import { migrate, openDatabase } from "../src/lib/db.ts";

function freshDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "xuanti-analytics-"));
  const db = openDatabase(path.join(dir, "app.db"));
  migrate(db);
  return db;
}

test("baidu tongji stays off unless an id is set", () => {
  const previous = process.env.BAIDU_TONGJI_ID;
  delete process.env.BAIDU_TONGJI_ID;
  assert.equal(baiduTongjiSnippet(), null);
  process.env.BAIDU_TONGJI_ID = "not valid";
  assert.equal(baiduTongjiSnippet(), null);
  process.env.BAIDU_TONGJI_ID = "abc123def456";
  const snippet = baiduTongjiSnippet();
  assert.ok(snippet?.includes("https://hm.baidu.com/hm.js?abc123def456"));
  assert.ok(!snippet?.includes("1.2.3.4"));
  if (previous == null) delete process.env.BAIDU_TONGJI_ID;
  else process.env.BAIDU_TONGJI_ID = previous;
});

test("visits hash ip and count uniques, actives, and returning users", () => {
  const db = freshDb();
  db.prepare(
    `INSERT INTO users (username, email, password_hash, role, tier, credits, created_at)
     VALUES ('店长', 'boss@example.com', 'x', 'user', 'free', 0, '2026-11-16T02:00:00.000Z')`,
  ).run();
  const first = recordVisit(db, { ip: "203.0.113.8", userAgent: "TestBrowser", userId: 1, day: "2026-11-16" });
  recordVisit(db, { ip: "203.0.113.8", userAgent: "TestBrowser", userId: 1, day: "2026-11-16" });
  recordVisit(db, { ip: "203.0.113.9", userAgent: "Other", day: "2026-11-16" });
  assert.notEqual(first.hash, "203.0.113.8");
  assert.equal(first.hash, visitorHash("203.0.113.8", "TestBrowser"));
  assert.equal(db.prepare("SELECT visitor_hash FROM daily_visitors").all().some((row) => String(row.visitor_hash).includes("203.0.113")), false);
  const dayOne = listDailyStats(db, 2, "2026-11-16").find((row) => row.day === "2026-11-16");
  assert.equal(dayOne?.pageViews, 3);
  assert.equal(dayOne?.uniqueVisitors, 2);
  assert.equal(dayOne?.activeUsers, 1);
  assert.equal(dayOne?.returningUsers, 0);
  assert.equal(dayOne?.newRegistrations, 1);

  recordVisit(db, { ip: "203.0.113.8", userAgent: "TestBrowser", userId: 1, day: "2026-11-17" });
  const dayTwo = listDailyStats(db, 2, "2026-11-17").find((row) => row.day === "2026-11-17");
  assert.equal(dayTwo?.uniqueVisitors, 1);
  assert.equal(dayTwo?.returningUsers, 1);
  assert.equal(dayTwo?.pageViews, 1);
  db.close();
});

test("memorial notice is only on the homepage in the three days before it", () => {
  const event = { caution: "当天不做营销和娱乐内容", startDate: "2026-12-13", endDate: "2026-12-13" };
  assert.equal(cautionVisibleOnHome(event, "2026-11-16"), false);
  assert.equal(cautionVisibleOnHome(event, "2026-12-09"), false);
  assert.equal(cautionVisibleOnHome(event, "2026-12-10"), true);
  assert.equal(cautionVisibleOnHome(event, "2026-12-13"), true);
  assert.equal(cautionVisibleOnHome(event, "2026-12-14"), false);
  assert.equal(shouldTrackPath("/"), true);
  assert.equal(shouldTrackPath("/admin"), false);
  assert.equal(shouldTrackPath("/api/health"), false);
  const previous = process.env.CASES_ENABLED;
  delete process.env.CASES_ENABLED;
  assert.equal(casesEnabled(), false);
  if (previous == null) delete process.env.CASES_ENABLED;
  else process.env.CASES_ENABLED = previous;
});
