import { authenticate, createSession } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { assertSameOrigin, clientIp, formString, redirectTo, safePath, setSessionCookie, HttpError } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const form = await req.formData();
    const next = safePath(formString(form, "next"), "/");
    const result = await authenticate(getDb(), formString(form, "account"), formString(form, "password"), clientIp(req));
    if (!result.ok) {
      return redirectTo(req, `/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`);
    }
    const token = createSession(getDb(), result.user.id);
    const response = redirectTo(req, next);
    setSessionCookie(response, token, req);
    return response;
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "登录失败";
    return redirectTo(req, `/login?error=${encodeURIComponent(message)}`);
  }
}
