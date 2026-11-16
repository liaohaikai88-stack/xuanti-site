import { isBillingEnabled, previewCount } from "./config";

export type AccessUser = {
  id: number;
  role: "user" | "admin";
  tier: "free" | "annual";
  membershipExpiresAt: string | null;
} | null;

export function membershipActive(user: Exclude<AccessUser, null>, now = new Date()): boolean {
  if (user.tier !== "annual" || !user.membershipExpiresAt) return false;
  return new Date(user.membershipExpiresAt).getTime() > now.getTime();
}

/** 登录且（收费关闭，或是有效年度会员，或是管理员）才能看全部内容。 */
export function hasFullAccess(user: AccessUser, now = new Date()): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!isBillingEnabled()) return true;
  return membershipActive(user, now);
}

export function canSearch(user: AccessUser, now = new Date()): boolean {
  return hasFullAccess(user, now);
}

export function canFavorite(user: AccessUser, now = new Date()): boolean {
  return hasFullAccess(user, now);
}

export function canReadTopic(
  topic: { id: number; status: string; publishDate: string },
  todaysPublished: Array<{ id: number }>,
  user: AccessUser,
  today: string,
  now = new Date(),
): boolean {
  if (topic.status !== "published") return user?.role === "admin";
  if (hasFullAccess(user, now)) return true;
  if (topic.publishDate !== today) return false;
  return splitPreview(todaysPublished, null, now).visible.some((item) => item.id === topic.id);
}

export function splitPreview<T>(items: T[], user: AccessUser, now = new Date()): { visible: T[]; lockedCount: number } {
  if (hasFullAccess(user, now)) return { visible: items, lockedCount: 0 };
  const count = previewCount();
  return {
    visible: items.slice(0, count),
    lockedCount: Math.max(0, items.length - count),
  };
}
