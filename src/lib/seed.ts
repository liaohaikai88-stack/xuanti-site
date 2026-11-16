import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { CsvTopicRow } from "./csv";
import { parseTopicCsv } from "./csv";
import { inferCalendarYear } from "./cn-date";
import {
  createCase,
  createTopic,
  ensureIndustry,
  importCalendarCsv,
  saveLegal,
} from "./content";
import { withTransaction } from "./db";
import { addDays, todayShanghai } from "./dates";

export function seedDirectory(): string {
  const candidates = [path.join(process.cwd(), "data", "seed"), path.join(process.cwd(), "..", "data", "seed")];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "topics.csv"))) return dir;
  }
  return candidates[0];
}

export function planRealTopics(rows: CsvTopicRow[], today: string): Array<CsvTopicRow & { publishDate: string; sortOrder: number }> {
  const groups = new Map<string, CsvTopicRow[]>();
  for (const row of rows) {
    const list = groups.get(row.industry) ?? [];
    list.push(row);
    groups.set(row.industry, list);
  }
  const names = [...groups.keys()];
  const days = [0, -1, -2].map((offset) => addDays(today, offset));
  const pattern = [4, 3, 3];
  const buckets: CsvTopicRow[][] = days.map(() => []);
  names.forEach((name, industryIndex) => {
    const list = groups.get(name) ?? [];
    const counts = [0, 1, 2].map((day) => pattern[(day - industryIndex + pattern.length) % pattern.length]);
    if (list.length !== counts.reduce((sum, count) => sum + count, 0)) {
      list.forEach((item, index) => buckets[index % days.length].push(item));
      return;
    }
    let cursor = 0;
    counts.forEach((count, dayIndex) => {
      for (let i = 0; i < count; i += 1) {
        buckets[dayIndex].push(list[cursor]);
        cursor += 1;
      }
    });
  });

  const planned: Array<CsvTopicRow & { publishDate: string; sortOrder: number }> = [];
  buckets.forEach((bucket, dayIndex) => {
    interleave(bucket).forEach((item, index) => {
      planned.push({ ...item, publishDate: days[dayIndex], sortOrder: index + 1 });
    });
  });
  return planned;
}

function interleave(items: CsvTopicRow[]): CsvTopicRow[] {
  const queues = new Map<string, CsvTopicRow[]>();
  for (const item of items) {
    const queue = queues.get(item.industry) ?? [];
    queue.push(item);
    queues.set(item.industry, queue);
  }
  const keys = [...queues.keys()];
  const result: CsvTopicRow[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const key of keys) {
      const queue = queues.get(key);
      const next = queue?.shift();
      if (next) {
        result.push(next);
        added = true;
      }
    }
  }
  return result;
}

const SAMPLE_TOPICS = [
  { industry: "餐饮", title: "【示例】新品试吃怎么拍才不像硬广", hook: "别一上来就报价格，先让观众听见你咬下去的声音", platform: "抖音", contentForm: "真人试吃" },
  { industry: "美业", title: "【示例】顾客离店前值得拍的一句话", hook: "她照镜子的那三秒，比十句介绍都有用", platform: "小红书", contentForm: "过程记录" },
  { industry: "本地生活", title: "【示例】下雨天门店也能发的一条", hook: "雨声先出镜，再告诉别人你还开着门", platform: "抖音/小红书", contentForm: "Vlog" },
  { industry: "餐饮", title: "【示例】打包袋上的小心思", hook: "顾客回家打开袋子的瞬间，才是第二条内容", platform: "视频号", contentForm: "实拍" },
];

export function seedIfEmpty(db: DatabaseSync, options: { today?: string; seedDir?: string } = {}): void {
  withTransaction(db, () => {
    const existing = db.prepare("SELECT COUNT(*) AS count FROM industries").get();
    if (Number(existing?.count ?? 0) > 0) return;
    seedFresh(db, options);
  });
}

function seedFresh(db: DatabaseSync, options: { today?: string; seedDir?: string }): void {
  const today = options.today ?? todayShanghai();
  const seedDir = options.seedDir ?? seedDirectory();
  for (const name of ["餐饮", "美业", "本地生活"]) ensureIndustry(db, name);

  const topicFile = path.join(seedDir, "topics.csv");
  const parsedTopics = parseTopicCsv(readFileSync(topicFile, "utf8"));
  if (parsedTopics.errors.length > 0) {
    throw new Error(`选题种子无法导入：${parsedTopics.errors.join("；")}`);
  }
  for (const item of planRealTopics(parsedTopics.rows, today)) {
    const industry = ensureIndustry(db, item.industry);
    createTopic(db, {
      industryId: industry.id,
      title: item.title,
      hook: item.hook,
      platform: item.platform,
      contentForm: item.contentForm,
      publishDate: item.publishDate,
      sortOrder: item.sortOrder,
      isSample: false,
      status: "published",
    });
  }

  const sampleDate = addDays(today, -3);
  SAMPLE_TOPICS.forEach((item, index) => {
    const industry = ensureIndustry(db, item.industry);
    createTopic(db, {
      industryId: industry.id,
      title: item.title,
      hook: item.hook,
      platform: item.platform,
      contentForm: item.contentForm,
      publishDate: sampleDate,
      sortOrder: index + 1,
      isSample: true,
      note: "这是演示选题，正式内容以编辑录入为准。",
      status: "published",
    });
  });

  const calendarResult = loadCalendarSeed(db, seedDir, today);
  if (calendarResult.imported === 0) {
    throw new Error(`日历种子没有导入：${calendarResult.errors.join("；") || "没有数据"}`);
  }

  const terms = readFileSync(path.join(seedDir, "terms.md"), "utf8");
  const privacy = readFileSync(path.join(seedDir, "privacy.md"), "utf8");
  saveLegal(db, "terms", "用户协议", terms);
  saveLegal(db, "privacy", "隐私政策", privacy);

  seedCases(db, today);
}

function seedCases(db: DatabaseSync, today: string): void {
  const food = ensureIndustry(db, "餐饮");
  const beauty = ensureIndustry(db, "美业");
  const local = ensureIndustry(db, "本地生活");
  createCase(db, {
    title: "【示例】后厨真相为什么能留下来",
    platform: "抖音",
    industryId: food.id,
    teaser: "一条后厨视频前三秒没有菜品特写，先给了观众一个进不去的门。示例拆解，用来看结构。",
    body: [
      "## 为什么能停住",
      "开头不是「欢迎光临」，而是一句观众自己也好奇、但平时看不到的话。",
      "## 结构",
      "1. 先给禁区：后厨门、手套、还没摆盘的菜。",
      "2. 再给一个具体真相，只讲一件事，不把菜单念完。",
      "3. 结尾把话题交回去：你最不能接受后厨的哪一点？",
      "## 你可以怎么拍",
      "手机固定在传菜口，老板出镜不超过十秒。不要配夸张音效。",
      "## 示例说明",
      "这篇是演示拆解，不是某条真实爆款的数据报告。",
    ].join("\n\n"),
    publishedAt: addDays(today, -2),
    isSample: true,
  });
  createCase(db, {
    title: "【示例】前后对比怎样才像真人",
    platform: "小红书",
    industryId: beauty.id,
    teaser: "同一面镜子、同一盏灯，比滤镜前后更让人停留。示例拆解，正式案例上线前可替换。",
    body: [
      "## 人们在看什么",
      "不是项目名称，是「这是不是同一个人」。",
      "## 结构",
      "1. 先拍做之前的真实状态，不要先磨皮。",
      "2. 过程只留两步关键手法。",
      "3. 做完回到同一机位，让观众自己比。",
      "## 注意",
      "不要承诺永久效果，不要用别人的图。",
      "## 示例说明",
      "这篇是演示文本。",
    ].join("\n\n"),
    publishedAt: addDays(today, -6),
    isSample: true,
  });
  createCase(db, {
    title: "【示例】一条街怎么拍成探店",
    platform: "抖音/小红书",
    industryId: local.id,
    teaser: "人均和走路声先出来，观众才愿意跟着你拐进下一家。示例拆解。",
    body: [
      "## 结构",
      "1. 街口定一个预算。",
      "2. 只进三家，每家一个记忆点。",
      "3. 结尾把路线说清，方便同城的人照着走。",
      "## 不要",
      "不要把每家的地址和优惠念成广告单。",
      "## 示例说明",
      "这篇是演示拆解。",
    ].join("\n\n"),
    publishedAt: addDays(today, -9),
    isSample: true,
  });
}

export function loadCalendarSeed(db: DatabaseSync, seedDir: string, today: string): { imported: number; skipped: number; errors: string[] } {
  const text = readFileSync(path.join(seedDir, "calendar.csv"), "utf8");
  return importCalendarCsv(db, text, { baseYear: inferCalendarYear(today), isSample: false });
}
