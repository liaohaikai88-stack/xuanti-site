import { createSession, registerUser } from "@/lib/auth";
import { saveSignupProfile } from "@/lib/shop";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { assertSameOrigin, formString, redirectTo, safePath, setSessionCookie, HttpError } from "@/lib/http";

export async function POST(req: Request) {
  const form = await req.formData();
  const next = safePath(formString(form, "next"), "/");
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const result = await registerUser(getDb(), {
      username: formString(form, "username"),
      email: formString(form, "email"),
      password: formString(form, "password"),
      passwordAgain: formString(form, "password_again"),
      consent: formString(form, "consent") === "yes",
    });
    if (!result.ok) {
      return redirectTo(req, `/register?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`);
    }
    saveSignupProfile(getDb(), result.user.id, formString(form, "sub_industry"));
    const token = createSession(getDb(), result.user.id);
    const response = redirectTo(req, next);
    setSessionCookie(response, token, req);
    return response;
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "注册失败";
    return redirectTo(req, `/register?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
  }
}
