import { ensureAdmin } from "./auth";
import { assertProductionSecrets } from "./config";
import { getDb } from "./db";
import { seedIfEmpty } from "./seed";

let bootstrapped = false;

function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.argv.includes("build")
  );
}

export async function ensureBootstrapped(): Promise<void> {
  if (bootstrapped || isBuildTime()) return;
  assertProductionSecrets();
  const db = getDb();
  seedIfEmpty(db);
  await ensureAdmin(db);
  bootstrapped = true;
}
