import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return full.endsWith(".tsx") || full.endsWith(".ts") ? [full] : [];
  });
}

test("public pages do not advertise the paused membership price", () => {
  const roots = ["src/app/(site)", "src/components"];
  const banned = ["199元", "199 元", "开通会员", "立即支付", "微信支付", "支付宝", "今日可拍"];
  const allow = new Set([path.normalize("src/app/(site)/pricing/page.tsx")]);
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of files(root)) {
      if (allow.has(path.normalize(file))) continue;
      const text = readFileSync(file, "utf8");
      for (const word of banned) {
        if (text.includes(word)) hits.push(`${file}: ${word}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
