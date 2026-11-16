import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, { N, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function scryptN(): number {
  const parsed = Number(process.env.SCRYPT_N || 16384);
  if (!Number.isInteger(parsed) || parsed < 1024) return 16384;
  return parsed;
}

export async function hashPassword(password: string): Promise<string> {
  const N = scryptN();
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, N);
  return `scrypt$${N}$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (!Number.isInteger(N) || salt.length === 0 || expected.length === 0) return false;
  const actual = await scrypt(password, salt, expected.length, N);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "密码至少 8 位";
  if (password.length > 72) return "密码最长 72 位";
  return null;
}
