import { destroySession } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { assertSameOrigin, clearSessionCookie, redirectTo } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  assertSameOrigin(req);
  await ensureBootstrapped();
  const jar = await cookies();
  destroySession(getDb(), jar.get("sid")?.value);
  const response = redirectTo(req, "/");
  clearSessionCookie(response);
  return response;
}
