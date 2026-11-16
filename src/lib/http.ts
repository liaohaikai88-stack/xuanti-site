import { NextResponse } from "next/server";
import { appUrl } from "./config";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return appUrl();
}

export function redirectTo(req: Request, pathname: string): NextResponse {
  return NextResponse.redirect(new URL(pathname, `${requestOrigin(req)}/`), 303);
}

export function safePath(input: string | null | undefined, fallback = "/"): string {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\") || input.includes("\n")) return fallback;
  return input;
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "请求来源不正确");
  }
  const allowed = new Set<string>();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) allowed.add(host);
  try {
    allowed.add(new URL(appUrl()).host);
  } catch {
    /* ignore invalid APP_URL */
  }
  if (!allowed.has(originHost)) throw new HttpError(403, "请求来源不正确");
}

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function setSessionCookie(response: NextResponse, token: string, req: Request): void {
  const proto = (req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")).split(",")[0].trim();
  response.cookies.set("sid", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https" || appUrl().startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set("sid", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim() || "local";
}
