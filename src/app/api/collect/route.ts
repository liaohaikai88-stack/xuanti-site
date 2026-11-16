import { recordVisit, shouldTrackPath } from "@/lib/analytics";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureBootstrapped();
  let path = "";
  try {
    const body = (await req.json()) as { path?: string };
    path = typeof body.path === "string" ? body.path : "";
  } catch {
    path = "";
  }
  if (!shouldTrackPath(path)) return NextResponse.json({ ok: true });
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim();
  const user = await getCurrentUser();
  recordVisit(getDb(), { ip, userAgent: req.headers.get("user-agent") || "", userId: user?.id ?? null });
  return NextResponse.json({ ok: true });
}
