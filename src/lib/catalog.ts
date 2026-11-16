import type { DatabaseSync } from "node:sqlite";

export const INDUSTRY_CATALOG = [
  {
    industry: "餐饮",
    items: [
      ["huoguo", "火锅"],
      ["naicha", "奶茶饮品"],
      ["hongbei", "烘焙甜品"],
      ["shaokao", "烧烤"],
      ["kuaican", "快餐小吃"],
      ["kafei", "咖啡"],
    ],
  },
  {
    industry: "美业",
    items: [
      ["meijia", "美甲"],
      ["meifa", "美发"],
      ["pifu", "皮肤管理"],
      ["meijie", "美睫"],
    ],
  },
  {
    industry: "本地生活",
    items: [
      ["jianshen", "健身"],
      ["chongwu", "宠物"],
      ["sheying", "摄影"],
      ["qinzi", "亲子"],
    ],
  },
] as const;

export type SubChoice = { industry: string; name: string; slug: string };

export function subChoices(): SubChoice[] {
  return INDUSTRY_CATALOG.flatMap((group) =>
    group.items.map(([slug, name]) => ({ industry: group.industry, name, slug })),
  );
}

export function parseSubChoice(value: string): SubChoice | null {
  const [industry, name] = value.split("/");
  if (!industry || !name) return null;
  return subChoices().find((item) => item.industry === industry && item.name === name) ?? null;
}

export function ensureSubIndustries(db: DatabaseSync): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO sub_industries (industry_id, slug, name, sort_order, extra_json) VALUES (?, ?, ?, ?, '{}')",
  );
  const rename = db.prepare("UPDATE sub_industries SET name = ?, sort_order = ? WHERE industry_id = ? AND slug = ?");
  for (const group of INDUSTRY_CATALOG) {
    const parent = db.prepare("SELECT id FROM industries WHERE name = ?").get(group.industry);
    if (!parent) continue;
    group.items.forEach(([slug, name], index) => {
      insert.run(parent.id, slug, name, index);
      rename.run(name, index, parent.id, slug);
    });
  }
}
