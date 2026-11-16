import type { DatabaseSync } from "node:sqlite";
import { ensureSubIndustries, parseSubChoice } from "./catalog";

export type ShopProfile = {
  userId: number;
  shopName: string;
  industryId: number | null;
  industryName: string;
  subIndustryId: number | null;
  subIndustryName: string;
  city: string;
  district: string;
  avgSpend: string;
  products: string[];
  sellingPoints: string;
  audience: string;
  tone: string;
  ownerOnCamera: boolean;
};

const TONES = new Set(["亲切", "专业", "轻松"]);

type ProfileJson = {
  district?: string;
  avgSpend?: string;
  products?: string[];
  sellingPoints?: string;
  audience?: string;
  tone?: string;
  ownerOnCamera?: boolean;
};

function readJson(raw: string): ProfileJson {
  try {
    const parsed = JSON.parse(raw) as ProfileJson;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getShopProfile(db: DatabaseSync, userId: number): ShopProfile | null {
  const row = db
    .prepare(
      `SELECT p.*, i.name AS industry_name, s.name AS sub_name
       FROM shop_profiles p
       LEFT JOIN industries i ON i.id = p.industry_id
       LEFT JOIN sub_industries s ON s.id = p.sub_industry_id
       WHERE p.user_id = ?`,
    )
    .get(userId);
  if (!row) return null;
  const extra = readJson(String(row.profile_json || "{}"));
  const products = Array.isArray(extra.products) ? extra.products.map((item) => String(item)).filter(Boolean).slice(0, 3) : [];
  return {
    userId,
    shopName: String(row.shop_name || ""),
    industryId: row.industry_id == null ? null : Number(row.industry_id),
    industryName: row.industry_name ? String(row.industry_name) : "",
    subIndustryId: row.sub_industry_id == null ? null : Number(row.sub_industry_id),
    subIndustryName: row.sub_name ? String(row.sub_name) : "",
    city: String(row.city || ""),
    district: String(extra.district || ""),
    avgSpend: String(extra.avgSpend || ""),
    products,
    sellingPoints: String(extra.sellingPoints || ""),
    audience: String(extra.audience || ""),
    tone: TONES.has(String(extra.tone)) ? String(extra.tone) : "亲切",
    ownerOnCamera: extra.ownerOnCamera === true,
  };
}

export function saveSignupProfile(db: DatabaseSync, userId: number, choice: string): void {
  const parsed = parseSubChoice(choice);
  if (!parsed) throw new Error("请选择细分行业");
  ensureSubIndustries(db);
  const industry = db.prepare("SELECT id FROM industries WHERE name = ?").get(parsed.industry);
  if (!industry) throw new Error("请选择细分行业");
  const sub = db.prepare("SELECT id FROM sub_industries WHERE industry_id = ? AND name = ?").get(industry.id, parsed.name);
  if (!sub) throw new Error("请选择细分行业");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO shop_profiles (user_id, shop_name, industry_id, sub_industry_id, city, profile_json, created_at, updated_at)
     VALUES (?, '', ?, ?, '', '{}', ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET industry_id = excluded.industry_id, sub_industry_id = excluded.sub_industry_id, updated_at = excluded.updated_at`,
  ).run(userId, industry.id, sub.id, now, now);
}

export function saveShopProfile(
  db: DatabaseSync,
  userId: number,
  input: {
    shopName: string;
    choice: string;
    city: string;
    district: string;
    avgSpend: string;
    products: string[];
    sellingPoints: string;
    audience: string;
    tone: string;
    ownerOnCamera: boolean;
  },
): void {
  const parsed = parseSubChoice(input.choice);
  if (!parsed) throw new Error("请选择细分行业");
  ensureSubIndustries(db);
  const industry = db.prepare("SELECT id FROM industries WHERE name = ?").get(parsed.industry);
  const sub = industry
    ? db.prepare("SELECT id FROM sub_industries WHERE industry_id = ? AND name = ?").get(industry.id, parsed.name)
    : undefined;
  if (!industry || !sub) throw new Error("请选择细分行业");
  const extra: ProfileJson = {
    district: input.district.trim().slice(0, 40),
    avgSpend: input.avgSpend.trim().slice(0, 20),
    products: input.products.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    sellingPoints: input.sellingPoints.trim().slice(0, 200),
    audience: input.audience.trim().slice(0, 80),
    tone: TONES.has(input.tone) ? input.tone : "亲切",
    ownerOnCamera: input.ownerOnCamera,
  };
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO shop_profiles (user_id, shop_name, industry_id, sub_industry_id, city, profile_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       shop_name = excluded.shop_name,
       industry_id = excluded.industry_id,
       sub_industry_id = excluded.sub_industry_id,
       city = excluded.city,
       profile_json = excluded.profile_json,
       updated_at = excluded.updated_at`,
  ).run(
    userId,
    input.shopName.trim().slice(0, 40),
    industry.id,
    sub.id,
    input.city.trim().slice(0, 20),
    JSON.stringify(extra),
    now,
    now,
  );
}
