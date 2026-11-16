import type { DatabaseSync } from "node:sqlite";
import { isBillingEnabled } from "./config";
import { consumeCredit } from "./billing";
import { generateCopy, type CopyInput, type CopyResult } from "./llm";
import type { User } from "./types";

export async function runCopyTool(
  db: DatabaseSync,
  user: User | null,
  input: CopyInput,
): Promise<CopyResult | { error: string }> {
  if (!user) return { error: "请先登录后再生成" };
  const product = input.product.trim();
  if (!product || product.length > 40) return { error: "请填写 40 字以内的产品或招牌" };
  if (isBillingEnabled() && user.role !== "admin") {
    const charged = consumeCredit(db, user.id, "文案工具");
    if (!charged) return { error: "可用次数不足，请联系管理员补充。" };
  }
  return generateCopy({
    product,
    industry: input.industry?.trim(),
    platform: input.platform?.trim(),
    note: input.note?.trim().slice(0, 200),
  });
}
