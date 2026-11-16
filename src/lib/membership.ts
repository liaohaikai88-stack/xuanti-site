import type { DatabaseSync } from "node:sqlite";
import type { User } from "./types";

export type PlanSlug = "free" | "vip" | "shop";

export type PlanQuotas = {
  aiDaily: number;
  copyUnlock: number;
  forbiddenDaily: number;
};

type PlanRow = PlanQuotas & { name: string; sort: number; features: Record<string, boolean> };

const DEFAULTS: Record<PlanSlug, PlanRow> = {
  free: { name: "免费", sort: 0, aiDaily: 3, copyUnlock: 1, forbiddenDaily: 30, features: { seeAllCopies: false } },
  vip: { name: "VIP", sort: 1, aiDaily: 30, copyUnlock: -1, forbiddenDaily: -1, features: { seeAllCopies: true } },
  shop: { name: "门店版", sort: 2, aiDaily: 100, copyUnlock: -1, forbiddenDaily: -1, features: { seeAllCopies: true } },
};

function envNumber(name: string): number | null {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(-1, Math.min(1000, Math.floor(parsed)));
}

function seedQuotas(slug: PlanSlug): PlanQuotas {
  if (slug === "free") {
    return {
      aiDaily: envNumber("AI_FREE_DAILY_MESSAGES") ?? DEFAULTS.free.aiDaily,
      copyUnlock: envNumber("FREE_COPY_COUNT") ?? DEFAULTS.free.copyUnlock,
      forbiddenDaily: DEFAULTS.free.forbiddenDaily,
    };
  }
  if (slug === "vip") {
    return {
      aiDaily: envNumber("AI_VIP_DAILY_MESSAGES") ?? DEFAULTS.vip.aiDaily,
      copyUnlock: DEFAULTS.vip.copyUnlock,
      forbiddenDaily: DEFAULTS.vip.forbiddenDaily,
    };
  }
  return {
    aiDaily: envNumber("AI_SHOP_DAILY_MESSAGES") ?? DEFAULTS.shop.aiDaily,
    copyUnlock: DEFAULTS.shop.copyUnlock,
    forbiddenDaily: DEFAULTS.shop.forbiddenDaily,
  };
}

export function ensurePlans(db: DatabaseSync): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO membership_plans (slug, name, sort_order, quotas_json, features_json, extra_json)
     VALUES (?, ?, ?, ?, ?, '{}')`,
  );
  (Object.keys(DEFAULTS) as PlanSlug[]).forEach((slug) => {
    const item = DEFAULTS[slug];
    const quotas = seedQuotas(slug);
    insert.run(slug, item.name, item.sort, JSON.stringify(quotas), JSON.stringify(item.features));
  });
  const legacy = db.prepare("SELECT id, vip_expires_at FROM users WHERE vip_expires_at IS NOT NULL").all();
  const exists = db.prepare("SELECT user_id FROM user_memberships WHERE user_id = ?");
  const grant = db.prepare(
    "INSERT INTO user_memberships (user_id, tier_slug, expires_at, granted_at, note) VALUES (?, 'vip', ?, ?, '')",
  );
  const now = new Date().toISOString();
  for (const row of legacy) {
    if (exists.get(row.id)) continue;
    grant.run(row.id, String(row.vip_expires_at), now);
  }
}

export function isPlanSlug(value: string): value is PlanSlug {
  return value === "free" || value === "vip" || value === "shop";
}

export function planName(slug: PlanSlug): string {
  return DEFAULTS[slug].name;
}

function parseQuotas(raw: string, slug: PlanSlug): PlanQuotas & { customized: boolean } {
  const fallback = seedQuotas(slug);
  try {
    const parsed = JSON.parse(raw) as Partial<PlanQuotas> & { customized?: boolean };
    const numberOr = (value: unknown, backup: number) => (typeof value === "number" && Number.isFinite(value) ? value : backup);
    return {
      aiDaily: numberOr(parsed.aiDaily, fallback.aiDaily),
      copyUnlock: numberOr(parsed.copyUnlock, fallback.copyUnlock),
      forbiddenDaily: numberOr(parsed.forbiddenDaily, fallback.forbiddenDaily),
      customized: parsed.customized === true,
    };
  } catch {
    return { ...fallback, customized: false };
  }
}

export function resolvedQuotas(db: DatabaseSync, slug: PlanSlug): PlanQuotas {
  const row = db.prepare("SELECT quotas_json FROM membership_plans WHERE slug = ?").get(slug);
  const parsed = parseQuotas(String(row?.quotas_json || "{}"), slug);
  if (parsed.customized) {
    return { aiDaily: parsed.aiDaily, copyUnlock: parsed.copyUnlock, forbiddenDaily: parsed.forbiddenDaily };
  }
  const seeded = seedQuotas(slug);
  return {
    aiDaily: seeded.aiDaily,
    copyUnlock: slug === "free" ? seeded.copyUnlock : parsed.copyUnlock,
    forbiddenDaily: parsed.forbiddenDaily,
  };
}

export function setPlanQuotas(db: DatabaseSync, slug: PlanSlug, quotas: PlanQuotas): void {
  const current = resolvedQuotas(db, slug);
  const next = {
    aiDaily: clampQuota(quotas.aiDaily, current.aiDaily),
    copyUnlock: clampQuota(quotas.copyUnlock, current.copyUnlock),
    forbiddenDaily: clampQuota(quotas.forbiddenDaily, current.forbiddenDaily),
    customized: true,
  };
  db.prepare("UPDATE membership_plans SET quotas_json = ? WHERE slug = ?").run(JSON.stringify(next), slug);
}

function clampQuota(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(-1, Math.min(1000, Math.floor(value)));
}

export function activePlan(user: Pick<User, "planSlug" | "planExpiresAt"> | null, now = new Date()): PlanSlug {
  if (!user || user.planSlug === "free") return "free";
  if (!user.planExpiresAt) return "free";
  if (new Date(user.planExpiresAt).getTime() <= now.getTime()) return "free";
  return user.planSlug;
}

export function planBadge(user: Pick<User, "planSlug" | "planExpiresAt"> | null, now = new Date()): string | null {
  const slug = activePlan(user, now);
  if (slug === "vip") return "VIP";
  if (slug === "shop") return "门店版";
  return null;
}

export function hydrateUsers(db: DatabaseSync, users: User[]): User[] {
  if (users.length === 0) return users;
  const rows = db
    .prepare(
      `SELECT user_id, tier_slug, expires_at FROM user_memberships WHERE user_id IN (${users.map(() => "?").join(",")})`,
    )
    .all(...users.map((user) => user.id));
  const plans = new Map<number, { slug: PlanSlug; expiresAt: string | null }>();
  for (const row of rows) {
    const slug = String(row.tier_slug);
    if (!isPlanSlug(slug) || slug === "free") continue;
    plans.set(Number(row.user_id), { slug, expiresAt: row.expires_at ? String(row.expires_at) : null });
  }
  return users.map((user) => {
    const plan = plans.get(user.id);
    if (plan) return { ...user, planSlug: plan.slug, planExpiresAt: plan.expiresAt };
    if (user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now()) {
      return { ...user, planSlug: "vip", planExpiresAt: user.vipExpiresAt };
    }
    return user;
  });
}

export function grantPlan(db: DatabaseSync, userId: number, slug: Exclude<PlanSlug, "free">, expiresAt: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO user_memberships (user_id, tier_slug, expires_at, granted_at, note)
     VALUES (?, ?, ?, ?, '')
     ON CONFLICT(user_id) DO UPDATE SET tier_slug = excluded.tier_slug, expires_at = excluded.expires_at, granted_at = excluded.granted_at`,
  ).run(userId, slug, expiresAt, now);
  db.prepare("UPDATE users SET vip_expires_at = ?, ai_beta = 1 WHERE id = ?").run(expiresAt, userId);
}

export function clearPlan(db: DatabaseSync, userId: number): void {
  db.prepare("DELETE FROM user_memberships WHERE user_id = ?").run(userId);
  db.prepare("UPDATE users SET vip_expires_at = NULL WHERE id = ?").run(userId);
}

export function setAiBeta(db: DatabaseSync, userId: number, enabled: boolean): void {
  db.prepare("UPDATE users SET ai_beta = ? WHERE id = ?").run(enabled ? 1 : 0, userId);
}

export function aiBetaOnly(): boolean {
  const value = (process.env.AI_BETA_ONLY ?? "true").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function canUseAi(user: { role?: string; aiBeta?: boolean } | null): boolean {
  if (!user) return false;
  if (!aiBetaOnly()) return true;
  if (user.role === "admin") return true;
  return Boolean(user.aiBeta);
}

export function copyUnlockFor(db: DatabaseSync, user: User | null, now = new Date()): number {
  if (user?.role === "admin") return -1;
  return resolvedQuotas(db, activePlan(user, now)).copyUnlock;
}

export function aiQuotaFor(db: DatabaseSync, user: User): number {
  const own = resolvedQuotas(db, activePlan(user)).aiDaily;
  if (user.role === "admin") return Math.max(own, resolvedQuotas(db, "shop").aiDaily);
  return own;
}

export function forbiddenQuotaFor(db: DatabaseSync, user: User | null): number {
  if (!user) {
    const parsed = envNumber("FORBIDDEN_ANON_DAILY");
    return parsed == null ? 5 : parsed;
  }
  const quota = resolvedQuotas(db, activePlan(user)).forbiddenDaily;
  if (user.role === "admin") return quota < 0 ? 1000 : Math.max(quota, 1000);
  return quota < 0 ? 1000 : quota;
}

export function forbiddenUnlimited(db: DatabaseSync, user: User | null): boolean {
  if (!user) return false;
  return resolvedQuotas(db, activePlan(user)).forbiddenDaily < 0 || user.role === "admin";
}

export function planPrices(): { vip: { month: number; year: number }; shop: { month: number; year: number } } {
  const read = (name: string, fallback: number) => {
    const parsed = Number(process.env[name] ?? fallback);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    vip: { month: read("VIP_MONTH_YUAN", 29.9), year: read("VIP_YEAR_YUAN", 199) },
    shop: { month: read("SHOP_MONTH_YUAN", 99), year: read("SHOP_YEAR_YUAN", 699) },
  };
}
