import { mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
export const backupState = {
  lastAutomatic: null as string | null,
  error: null as string | null,
};
export async function createBackup(prefix = "store") {
  const directory = resolve(process.env.BACKUP_DIR ?? "backups");
  await mkdir(directory, { recursive: true });
  const filename = `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}.db`;
  const path = resolve(directory, filename);
  await db.$executeRawUnsafe(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
  return { filename, path };
}
let running = false;
export async function backupDaily() {
  if (running || !(await db.user.count())) return;
  running = true;
  try {
    const directory = resolve(process.env.BACKUP_DIR ?? "backups");
    await mkdir(directory, { recursive: true });
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const prefix = `auto-${today}`;
    const existing = (await readdir(directory)).find(
      (name) => name.startsWith(prefix) && name.endsWith(".db"),
    );
    backupState.lastAutomatic = existing
      ? resolve(directory, existing)
      : (await createBackup(prefix)).path;
    backupState.error = null;
  } catch (e) {
    backupState.error = (e as Error).message;
    console.error("Automatic backup failed:", backupState.error);
  } finally {
    running = false;
  }
}
