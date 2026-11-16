import { ensureBootstrapped } from "@/lib/bootstrap";
import { runCopyTool } from "@/lib/copy-tool";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  assertSameOrigin(req);
  await ensureBootstrapped();
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as {
    product?: string;
    industry?: string;
    platform?: string;
    note?: string;
  };
  const result = await runCopyTool(getDb(), user, {
    product: body.product || "",
    industry: body.industry,
    platform: body.platform,
    note: body.note,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: user ? 400 : 401 });
  }
  return NextResponse.json(result);
}
