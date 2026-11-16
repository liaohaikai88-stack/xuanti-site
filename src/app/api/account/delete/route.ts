import { deleteAccount, destroySession } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, clearSessionCookie, formString, redirectTo } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  assertSameOrigin(req);
  await ensureBootstrapped();
  const user = await getCurrentUser();
  if (!user) return redirectTo(req, "/login?next=/me");
  const form = await req.formData();
  const result = await deleteAccount(getDb(), user.id, formString(form, "password"));
  if (!result.ok) return redirectTo(req, `/me?error=${encodeURIComponent(result.error)}`);
  const jar = await cookies();
  destroySession(getDb(), jar.get("sid")?.value);
  const response = redirectTo(req, "/?ok=account-deleted");
  clearSessionCookie(response);
  return response;
}
