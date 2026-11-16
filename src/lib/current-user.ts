import { cookies } from "next/headers";
import { findUserBySession } from "./auth";
import { getDb } from "./db";
import type { User } from "./types";

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  return findUserBySession(getDb(), jar.get("sid")?.value);
}
