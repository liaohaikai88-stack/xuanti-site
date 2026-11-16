import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const source = process.env.DATABASE_PATH || "./data/app.db";
const backupDir = process.env.BACKUP_DIR || "./data/backups";
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDir, `xuanti-${stamp}.db`);

const db = new DatabaseSync(source);
db.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
db.close();

const keepDays = Number(process.env.BACKUP_KEEP_DAYS || 14);
const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
for (const name of readdirSync(backupDir)) {
  if (!name.endsWith(".db")) continue;
  const full = path.join(backupDir, name);
  if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
}
console.log(destination);
