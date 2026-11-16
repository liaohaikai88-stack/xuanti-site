import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { annualPriceFen, isBillingEnabled } from "./config";
import { withTransaction } from "./db";
import type { Order } from "./types";

/**
 * 支付渠道接口。现在只有人工开通。
 * 微信支付、支付宝实现这个接口后，把 PAYMENT_PROVIDER 改成 wechat 或 alipay。
 * 在 MEMBERSHIP_BILLING_ENABLED=false 时，用户侧不会创建订单，也不会看到价格。
 */
export interface PaymentProvider {
  id: "manual" | "wechat" | "alipay";
  createIntent(input: { orderNo: string; amountFen: number; subject: string }): {
    mode: "manual" | "redirect";
    message: string;
    payUrl?: string;
  };
}

export class PaymentNotReadyError extends Error {}

export function getPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER || "manual").trim().toLowerCase();
  if (id === "wechat" || id === "alipay") {
    return {
      id,
      createIntent() {
        throw new PaymentNotReadyError(`${id === "wechat" ? "微信支付" : "支付宝"}还没有接入。请继续使用人工开通。`);
      },
    };
  }
  return {
    id: "manual",
    createIntent({ orderNo }) {
      return {
        mode: "manual",
        message: `订单 ${orderNo} 已提交。管理员确认收款后，会把账号开通为年度会员。`,
      };
    },
  };
}

function mapOrder(row: Record<string, unknown>): Order {
  return {
    id: Number(row.id),
    orderNo: String(row.order_no),
    userId: Number(row.user_id),
    username: String(row.username ?? ""),
    email: String(row.email ?? ""),
    amountFen: Number(row.amount_fen),
    status: row.status as Order["status"],
    provider: String(row.provider),
    providerRef: row.provider_ref ? String(row.provider_ref) : null,
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    activatedBy: row.activated_by == null ? null : Number(row.activated_by),
  };
}

export function createMembershipOrder(db: DatabaseSync, userId: number): { order: Order; message: string; payUrl?: string } {
  if (!isBillingEnabled()) {
    throw new Error("收费功能未开启");
  }
  const provider = getPaymentProvider();
  const orderNo = `XT${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${randomBytes(3).toString("hex")}`;
  const amountFen = annualPriceFen();
  const intent = provider.createIntent({ orderNo, amountFen, subject: "今天拍啥年度会员" });
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO orders (order_no, user_id, amount_fen, status, provider, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(orderNo, userId, amountFen, provider.id, createdAt);
  const order = getOrder(db, Number(result.lastInsertRowid));
  if (!order) throw new Error("订单创建失败");
  return { order, message: intent.message, payUrl: intent.payUrl };
}

export function getOrder(db: DatabaseSync, id: number): Order | null {
  const row = db
    .prepare(
      `SELECT o.*, u.username, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`,
    )
    .get(id);
  return row ? mapOrder(row) : null;
}

export function listOrders(db: DatabaseSync, limit = 100): Order[] {
  return db
    .prepare(
      `SELECT o.*, u.username, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC LIMIT ?`,
    )
    .all(limit)
    .map(mapOrder);
}

export function listOrdersForUser(db: DatabaseSync, userId: number): Order[] {
  return db
    .prepare(
      `SELECT o.*, u.username, u.email
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.user_id = ?
       ORDER BY o.id DESC`,
    )
    .all(userId)
    .map(mapOrder);
}

export function activateOrder(db: DatabaseSync, orderNo: string, adminId: number): Order {
  return withTransaction(db, () => {
    const row = db.prepare("SELECT * FROM orders WHERE order_no = ?").get(orderNo);
    if (!row) throw new Error("找不到订单");
    if (row.status === "paid") {
      const existing = db
        .prepare(
          `SELECT o.*, u.username, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_no = ?`,
        )
        .get(orderNo);
      return mapOrder(existing!);
    }
    if (row.status !== "pending") throw new Error("这个订单不能开通");
    const now = new Date();
    const user = db.prepare("SELECT membership_expires_at, tier FROM users WHERE id = ?").get(row.user_id);
    const currentExpiry = user?.membership_expires_at ? new Date(String(user.membership_expires_at)) : null;
    const start = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expires = new Date(start.getTime());
    expires.setUTCFullYear(expires.getUTCFullYear() + 1);
    db.prepare(
      `UPDATE users SET tier = 'annual', membership_expires_at = ? WHERE id = ?`,
    ).run(expires.toISOString(), row.user_id);
    db.prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, activated_by = ? WHERE order_no = ?`,
    ).run(now.toISOString(), adminId, orderNo);
    const updated = db
      .prepare(
        `SELECT o.*, u.username, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.order_no = ?`,
      )
      .get(orderNo);
    return mapOrder(updated!);
  });
}

export function grantAnnualMembership(db: DatabaseSync, userId: number, years = 1): void {
  const now = new Date();
  const user = db.prepare("SELECT membership_expires_at FROM users WHERE id = ?").get(userId);
  if (!user) throw new Error("找不到用户");
  const currentExpiry = user.membership_expires_at ? new Date(String(user.membership_expires_at)) : null;
  const start = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const expires = new Date(start.getTime());
  expires.setUTCFullYear(expires.getUTCFullYear() + years);
  db.prepare(`UPDATE users SET tier = 'annual', membership_expires_at = ? WHERE id = ?`).run(
    expires.toISOString(),
    userId,
  );
}

export function clearMembership(db: DatabaseSync, userId: number): void {
  db.prepare(`UPDATE users SET tier = 'free', membership_expires_at = NULL WHERE id = ?`).run(userId);
}

export function adjustCredits(db: DatabaseSync, userId: number, delta: number, reason: string): number {
  return withTransaction(db, () => {
    const row = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId);
    if (!row) throw new Error("找不到用户");
    const next = Math.max(0, Number(row.credits) + delta);
    db.prepare("UPDATE users SET credits = ? WHERE id = ?").run(next, userId);
    db.prepare("INSERT INTO credit_ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      delta,
      reason,
      new Date().toISOString(),
    );
    return next;
  });
}

export function consumeCredit(db: DatabaseSync, userId: number, reason: string): boolean {
  return withTransaction(db, () => {
    const result = db.prepare("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits >= 1").run(userId);
    if (result.changes !== 1) return false;
    db.prepare("INSERT INTO credit_ledger (user_id, delta, reason, created_at) VALUES (?, -1, ?, ?)").run(
      userId,
      reason,
      new Date().toISOString(),
    );
    return true;
  });
}

export function orderPublicId(orderNo: string): string {
  return createHash("sha256").update(orderNo).digest("hex").slice(0, 10);
}
