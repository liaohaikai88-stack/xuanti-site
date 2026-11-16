export const brand = {
  name: "今天拍啥",
  tagline: "每天都有得拍",
  heroTitle: "每天10条，拍了就有流量的选题",
  heroAccent: "拍了就有流量",
  heroSubtitle: "专为餐饮、美业、本地生活老板准备",
  heroCta: "免费看今日选题",
  description:
    "今天拍啥，专为餐饮、美业、本地生活老板准备的抖音、小红书选题。每天更新可直接拍摄的题目和开头钩子。",
};

const INSECURE_SECRETS = new Set([
  "",
  "replace-with-a-long-random-string",
  "dev-insecure-secret-change-me",
]);

export function isBillingEnabled(): boolean {
  const value = (process.env.MEMBERSHIP_BILLING_ENABLED || "false").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function previewCount(): number {
  const parsed = Number(process.env.FREE_PREVIEW_COUNT ?? 4);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(5, Math.max(3, Math.round(parsed)));
}

export function annualPriceYuan(): number {
  const yuan = Number(process.env.ANNUAL_PRICE_YUAN ?? 199);
  if (!Number.isFinite(yuan) || yuan <= 0) return 199;
  return Math.round(yuan);
}

export function annualPriceFen(): number {
  return annualPriceYuan() * 100;
}

export function appUrl(): string {
  const configured = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return configured;
}

/** Primary public domain. Override with SITE_DOMAIN. */
export function siteDomain(): string {
  return (process.env.SITE_DOMAIN || "jintianpaisha.cn")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

/**
 * Origin used in the sitemap, robots.txt and SEO tags.
 * A localhost APP_URL is for the running app only, so the public default stays https://jintianpaisha.cn.
 */
export function canonicalUrl(): string {
  const configured = appUrl();
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured)) {
    return `https://${siteDomain()}`;
  }
  return configured;
}

export function secretKey(): string {
  return process.env.SECRET_KEY || "dev-insecure-secret-change-me";
}

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (INSECURE_SECRETS.has(process.env.SECRET_KEY || "")) {
    throw new Error("生产环境必须设置随机的 SECRET_KEY。请修改 /etc/xuanti.env 或 .env 后重启。");
  }
}

export function databasePath(): string {
  return process.env.DATABASE_PATH || "./data/app.db";
}
