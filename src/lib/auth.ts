import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { secretKey } from "./config";
import { insertId } from "./db";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import type { Role, Tier, User } from "./types";

const SESSION_DAYS = 30;

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    phone: row.phone ? String(row.phone) : null,
    consentAt: row.consent_at ? String(row.consent_at) : null,
    consentVersion: row.consent_version ? String(row.consent_version) : null,
    tier: row.tier === "annual" ? "annual" : "free",
    membershipExpiresAt: row.membership_expires_at ? String(row.membership_expires_at) : null,
    credits: Number(row.credits ?? 0),
    createdAt: String(row.created_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(`${secretKey()}:${token}`).digest("hex");
}

export function validateUsername(username: string): string | null {
  if (!/^[\p{L}\p{N}_]{2,20}$/u.test(username)) {
    return "用户名需要 2 到 20 位，可以用中文、字母、数字和下划线";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return "邮箱格式不正确";
  return null;
}

export function consentVersion(db: DatabaseSync): string {
  const docs = db.prepare("SELECT slug, updated_at FROM legal_docs ORDER BY slug").all();
  if (docs.length === 0) return "none";
  return docs.map((doc) => `${doc.slug}:${doc.updated_at}`).join("|");
}

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  passwordAgain?: string;
  consent: boolean;
};

export async function registerUser(db: DatabaseSync, input: RegisterInput): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  if (!input.consent) return { ok: false, error: "请先阅读并同意《用户协议》和《隐私政策》" };
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError };
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: emailError };
  if (input.passwordAgain != null && input.passwordAgain !== input.password) {
    return { ok: false, error: "两次输入的密码不一致" };
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };
  const existingEmail = db.prepare("SELECT id, deleted_at FROM users WHERE email = ?").get(email);
  if (existingEmail && !existingEmail.deleted_at) return { ok: false, error: "这个邮箱已经注册过了" };
  const existingName = db.prepare("SELECT id, deleted_at FROM users WHERE username = ?").get(username);
  if (existingName && !existingName.deleted_at) return { ok: false, error: "这个用户名已经有人用了" };

  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  const version = consentVersion(db);
  if (existingName?.deleted_at && Number(existingName.id) !== Number(existingEmail?.id ?? -1)) {
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(`deleted_${existingName.id}_${Date.now()}`, existingName.id);
  }
  let userId: number;
  if (existingEmail?.deleted_at) {
    db.prepare(
      `UPDATE users
       SET username = ?, email = ?, password_hash = ?, role = 'user', consent_at = ?, consent_version = ?,
           tier = 'free', membership_expires_at = NULL, credits = 0, deleted_at = NULL
       WHERE id = ?`,
    ).run(username, email, passwordHash, now, version, existingEmail.id);
    userId = Number(existingEmail.id);
  } else {
    const result = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, role, consent_at, consent_version, tier, credits, created_at)
         VALUES (?, ?, ?, 'user', ?, ?, 'free', 0, ?)`,
      )
      .run(username, email, passwordHash, now, version, now);
    userId = insertId(result);
  }
  const user = getUserById(db, userId);
  if (!user) return { ok: false, error: "注册失败，请稍后再试" };
  return { ok: true, user };
}

export function getUserById(db: DatabaseSync, id: number): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL").get(id);
  return row ? mapUser(row) : null;
}

export async function authenticate(
  db: DatabaseSync,
  account: string,
  password: string,
  ip: string,
): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const key = `${ip}:${account.trim().toLowerCase()}`;
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const attempts = db
    .prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE attempt_key = ? AND created_at >= ?")
    .get(key, since);
  if (Number(attempts?.count ?? 0) >= 8) {
    return { ok: false, error: "尝试次数太多，请 15 分钟后再试" };
  }

  const normalized = account.trim();
  const row = normalized.includes("@")
    ? db.prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL").get(normalized.toLowerCase())
    : db.prepare("SELECT * FROM users WHERE username = ? AND deleted_at IS NULL").get(normalized);
  const valid = row ? await verifyPassword(password, String(row.password_hash)) : false;
  if (!row || !valid) {
    db.prepare("INSERT INTO login_attempts (attempt_key, created_at) VALUES (?, ?)").run(key, new Date().toISOString());
    return { ok: false, error: "账号或密码不正确" };
  }
  db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").run(key);
  return { ok: true, user: mapUser(row) };
}

export function createSession(db: DatabaseSync, userId: number): string {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    userId,
    hashSessionToken(token),
    expires,
    new Date().toISOString(),
  );
  return token;
}

export function findUserBySession(db: DatabaseSync, token: string | undefined): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
    )
    .get(hashSessionToken(token), new Date().toISOString());
  return row ? mapUser(row) : null;
}

export function destroySession(db: DatabaseSync, token: string | undefined): void {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

export async function deleteAccount(db: DatabaseSync, userId: number, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = db.prepare("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL").get(userId);
  if (!row) return { ok: false, error: "账号不存在" };
  const valid = await verifyPassword(password, String(row.password_hash));
  if (!valid) return { ok: false, error: "密码不正确" };
  const now = new Date().toISOString();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare(
    `UPDATE users
     SET username = ?, email = ?, password_hash = 'deleted', phone = NULL, deleted_at = ?
     WHERE id = ?`,
  ).run(`deleted_${userId}`, `deleted_${userId}@invalid.local`, now, userId);
  return { ok: true };
}

export function listUsers(db: DatabaseSync, limit = 200): User[] {
  return db
    .prepare("SELECT * FROM users WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ?")
    .all(limit)
    .map(mapUser);
}

export function updateUserAdmin(
  db: DatabaseSync,
  userId: number,
  patch: { role?: Role; tier?: Tier; membershipExpiresAt?: string | null; creditDelta?: number },
): void {
  const user = getUserById(db, userId);
  if (!user) throw new Error("找不到用户");
  if (patch.role) db.prepare("UPDATE users SET role = ? WHERE id = ?").run(patch.role, userId);
  if (patch.tier) db.prepare("UPDATE users SET tier = ? WHERE id = ?").run(patch.tier, userId);
  if (patch.membershipExpiresAt !== undefined) {
    db.prepare("UPDATE users SET membership_expires_at = ? WHERE id = ?").run(patch.membershipExpiresAt, userId);
  }
  if (patch.creditDelta) {
    db.prepare("UPDATE users SET credits = MAX(0, credits + ?) WHERE id = ?").run(patch.creditDelta, userId);
    db.prepare("INSERT INTO credit_ledger (user_id, delta, reason, created_at) VALUES (?, ?, '管理员调整', ?)").run(
      userId,
      patch.creditDelta,
      new Date().toISOString(),
    );
  }
}

export async function ensureAdmin(db: DatabaseSync): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  if (!email || !password) return;
  const existing = db.prepare("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL").get(email);
  if (existing) return;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (username, email, password_hash, role, consent_at, consent_version, tier, credits, created_at)
     VALUES (?, ?, ?, 'admin', ?, 'seed-admin', 'annual', 0, ?)`,
  ).run(username, email, passwordHash, now, now);
}
