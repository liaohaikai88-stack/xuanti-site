import { readFileSync } from "node:fs";
import path from "node:path";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { seedDirectory } from "@/lib/seed";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  await ensureBootstrapped();
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "需要管理员登录" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  const filename = kind === "calendar" ? "calendar.csv" : kind === "topics" ? "topics.csv" : "";
  if (!filename) return NextResponse.json({ error: "未知模板" }, { status: 404 });
  const text = readFileSync(path.join(seedDirectory(), filename), "utf8");
  return new NextResponse(text, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
