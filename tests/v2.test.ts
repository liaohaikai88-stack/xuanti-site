import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { canSeeAllCopies, isVip } from "../src/lib/access.ts";
import { assertCanSend, createConversation, addMessage } from "../src/lib/ai-chat.ts";
import { completeChat, completionsUrl, streamChat } from "../src/lib/ai-client.ts";
import { benchmarkAsOf, importBenchmarkCsv } from "../src/lib/benchmarks.ts";
import { createTopicCopy, importCopyCsv, splitCopiesForViewer } from "../src/lib/copies.ts";
import { findForbiddenHits } from "../src/lib/forbidden.ts";
import { importHotIdeas } from "../src/lib/hot.ts";
import { activePlan, grantPlan, resolvedQuotas } from "../src/lib/membership.ts";
import { parseStoryboard } from "../src/lib/storyboard.ts";
import { migrate, openDatabase } from "../src/lib/db.ts";
import { isBlockedHotTitle, listHotRows, parseDouyin, rankTrend, refreshHotLists, relevanceTags } from "../src/lib/hot.ts";
import { findSensitive } from "../src/lib/safety.ts";

function freshDb() {
  const dir = mkdtempSync(path.join(tmpdir(), "xuanti-v2-"));
  const db = openDatabase(path.join(dir, "app.db"));
  migrate(db);
  db.prepare(
    `INSERT INTO users (username, email, password_hash, role, tier, credits, created_at)
     VALUES ('店长', 'boss@example.com', 'x', 'user', 'free', 0, '2026-11-16T02:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO industries (slug, name, color, description, sort_order, created_at) VALUES ('canyin', '餐饮', '#ff6a2a', '', 1, '2026-11-16T00:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO topics (industry_id, title, hook, platform, content_form, publish_date, sort_order, note, is_sample, status, created_at, updated_at)
     VALUES (1, '后厨真相', '开门', '抖音', '口播', '2026-11-16', 1, '', 0, 'published', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z')`,
  ).run();
  return db;
}

test("vip expiry gates extra reference copies", () => {
  assert.equal(isVip({ vipExpiresAt: "2099-01-01T00:00:00.000Z" }), true);
  assert.equal(isVip({ vipExpiresAt: "2000-01-01T00:00:00.000Z" }), false);
  const db = freshDb();
  for (const label of ["口播脚本", "小红书笔记", "故事型"]) {
    createTopicCopy(db, { topicId: 1, styleLabel: label, body: `${label}正文`, breakdown: [{ heading: "钩子", text: "具体" }], status: "published" });
  }
  const copies = ["a", "b", "c"];
  assert.equal(splitCopiesForViewer(copies, 1).open.length, 1);
  assert.equal(splitCopiesForViewer(copies, -1).locked.length, 0);
  assert.equal(splitCopiesForViewer(copies, 0).open.length, 0);
  process.env.FREE_COPY_COUNT = "0";
  assert.equal(resolvedQuotas(db, "free").copyUnlock, 0);
  delete process.env.FREE_COPY_COUNT;
  const board = parseStoryboard("镜头1 0-3秒 | 后厨门 | 开门 | 固定");
  assert.equal(board.rows[0]?.no, "镜头1");
  assert.equal(board.rows[0]?.duration, "0-3秒");
  assert.equal(board.rows[0]?.method, "固定");
  assert.equal(parseStoryboard("没有分隔符").rows.length, 0);
  const imported = importCopyCsv(db, "选题标题,文案风格,文案正文,为什么这样写,分镜\n后厨真相,标题加开头,后厨门开了,钩子：先给结果 || 平台：抖音,镜头1 0-3秒 | 后厨门 | 开门\n");
  assert.equal(imported.imported, 1);
  const stored = db.prepare("SELECT storyboard FROM topic_copies WHERE style_label = '标题加开头'").get();
  assert.match(String(stored?.storyboard), /镜头1/);
  db.close();
});

test("free chat quota stops at three messages", () => {
  const previousFree = process.env.AI_FREE_DAILY_MESSAGES;
  const previousBeta = process.env.AI_BETA_ONLY;
  process.env.AI_FREE_DAILY_MESSAGES = "3";
  process.env.AI_BETA_ONLY = "false";
  const db = freshDb();
  const id = createConversation(db, 1, "试试", null);
  addMessage(db, id, "user", "第一条");
  addMessage(db, id, "user", "第二条");
  addMessage(db, id, "user", "第三条");
  assert.throws(() => assertCanSend(db, { id: 1 }), /免费次数用完了/);
  grantPlan(db, 1, "vip", "2099-01-01T00:00:00.000Z");
  assert.equal(activePlan({ planSlug: "vip", planExpiresAt: "2099-01-01T00:00:00.000Z" }), "vip");
  assert.equal(activePlan({ planSlug: "vip", planExpiresAt: "2000-01-01T00:00:00.000Z" }), "free");
  assert.doesNotThrow(() => assertCanSend(db, { id: 1 }));
  assert.equal(canSeeAllCopies({ role: "user", vipExpiresAt: "2099-01-01T00:00:00.000Z" }), true);
  process.env.AI_BETA_ONLY = "true";
  db.prepare("UPDATE users SET ai_beta = 0 WHERE id = 1").run();
  db.prepare("DELETE FROM user_memberships WHERE user_id = 1").run();
  assert.throws(() => assertCanSend(db, { id: 1 }), /内测中/);
  if (previousFree == null) delete process.env.AI_FREE_DAILY_MESSAGES;
  else process.env.AI_FREE_DAILY_MESSAGES = previousFree;
  if (previousBeta == null) delete process.env.AI_BETA_ONLY;
  else process.env.AI_BETA_ONLY = previousBeta;
  db.close();
});

test("benchmark csv stores titles numbers and links only", () => {
  const db = freshDb();
  const result = importBenchmarkCsv(
    db,
    "选题标题,对标标题,平台,点赞,收藏,链接,查找时间\n后厨真相,后厨开门,抖音,,12,https://example.com/v,2026-11-01\n",
  );
  assert.equal(result.imported, 1);
  const row = db.prepare("SELECT * FROM benchmark_cases").get();
  assert.equal(row?.likes, null);
  assert.equal(Number(row?.favorites), 12);
  assert.equal(benchmarkAsOf("2026-11-01"), "数据截至 2026-11-01");
  assert.equal(Object.keys(row || {}).includes("body"), false);
  const hits = findForbiddenHits("这是全网最顶级", [
    { id: 1, phrase: "顶级", replacement: "用心做", category: "绝对化" },
    { id: 2, phrase: "最", replacement: "很", category: "绝对化" },
  ]);
  assert.equal(hits.some((hit) => hit.phrase === "顶级"), true);
  const ideas = importHotIdeas(db, [{ title: "冬日火锅", platform: "微博", rank: 3, heat: null, url: "https://example.com", fetched_at: "2026-11-16T01:00:00.000Z", industry: "餐饮", idea: "拍开锅" }]);
  assert.equal(ideas.imported, 1);
  db.close();
});

test("provider client uses mocked chat completions", async () => {
  assert.equal(completionsUrl("https://api.deepseek.com"), "https://api.deepseek.com/chat/completions");
  assert.equal(completionsUrl("https://api.moonshot.cn/v1"), "https://api.moonshot.cn/v1/chat/completions");
  const text = await completeChat({
    settings: { apiKey: "test-key", baseUrl: "https://example.test", model: "demo" },
    messages: [{ role: "user", content: "你好" }],
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, "demo");
      assert.equal((init?.headers as { authorization: string }).authorization, "Bearer test-key");
      return new Response(JSON.stringify({ choices: [{ message: { content: "可以这样拍" } }] }), { status: 200 });
    },
  });
  assert.equal(text, "可以这样拍");
  const streamed = await streamChat({
    settings: { apiKey: "test-key", baseUrl: "https://example.test/v1", model: "demo" },
    messages: [{ role: "user", content: "写一句" }],
    fetchImpl: async () => new Response("data: {\"choices\":[{\"delta\":{\"content\":\"门\"}}]}\n\ndata: [DONE]\n\n", { status: 200 }),
    onDelta() {},
  });
  assert.equal(streamed, "门");
  assert.equal(findSensitive("这是全网第一"), "全网第一");
});

test("hot list keeps the last good snapshot and drops tragedies", async () => {
  const db = freshDb();
  let fail = false;
  await refreshHotLists(db, {
    fetchText: async (url) => {
      if (fail || !url.includes("douyin")) throw new Error("down");
      return JSON.stringify({
        data: { word_list: [{ word: "火锅新品", hot_value: 10, position: 2 }, { word: "地震遇难人数", position: 1 }] },
      });
    },
  });
  const first = listHotRows(db, "douyin");
  assert.deepEqual(first.rows.map((row) => row.title), ["火锅新品"]);
  assert.equal(isBlockedHotTitle("地震遇难人数"), true);
  assert.deepEqual(relevanceTags("火锅新品"), ["餐饮"]);
  assert.equal(rankTrend(1, 4), "up");
  fail = true;
  await refreshHotLists(db, { fetchText: async () => { throw new Error("down"); } });
  assert.equal(listHotRows(db, "douyin").rows[0]?.title, "火锅新品");
  assert.equal(parseDouyin({ data: { word_list: [] } }).length, 0);
  db.close();
});

test("nginx install keeps an existing certificate config", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "xuanti-nginx-"));
  const conf = path.join(dir, "xuanti.conf");
  const cert = path.join(dir, "live");
  mkdirSync(cert, { recursive: true });
  writeFileSync(conf, "ssl_certificate /etc/letsencrypt/live/jintianpaisha.cn/fullchain.pem;\n# managed by Certbot\n");
  execFileSync("bash", ["-lc", `source deploy/install-nginx.sh; NGINX_SITE_CONF='${conf}' LETSENCRYPT_LIVE='${cert}' SITE_DOMAIN=jintianpaisha.cn install_nginx_site`], { cwd: process.cwd() });
  assert.match(readFileSync(conf, "utf8"), /Certbot/);
  const fresh = path.join(dir, "fresh.conf");
  writeFileSync(path.join(cert, "fullchain.pem"), "cert");
  writeFileSync(path.join(cert, "privkey.pem"), "key");
  execFileSync("bash", ["-lc", `source deploy/install-nginx.sh; NGINX_SITE_CONF='${fresh}' LETSENCRYPT_LIVE='${cert}' SITE_DOMAIN=jintianpaisha.cn install_nginx_site`], { cwd: process.cwd() });
  const https = readFileSync(fresh, "utf8");
  assert.match(https, /listen 443 ssl/);
  assert.match(https, /return 301 https:\/\/jintianpaisha\.cn/);
  assert.match(https, /server_name www\.jintianpaisha\.cn/);
});
