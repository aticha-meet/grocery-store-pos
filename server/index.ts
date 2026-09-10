import express from "express";
import { resolve } from "node:path";
import { app } from "./app.js";
import { db } from "./db.js";
import { backupDaily } from "./backup.js";
import { CALL_ENV } from "./config/call-env.js";
await db.$queryRawUnsafe("PRAGMA journal_mode = WAL");
await db.$executeRawUnsafe("PRAGMA synchronous = FULL");
await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000");

const env = CALL_ENV;

app.use(express.static(resolve("dist")));
app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
const server = app.listen(Number(env.PORT), env.hostname, () =>
  console.log(`บ้านร้าน POS: http://${env.hostname}:${env.PORT}`),
);

void backupDaily();
const backupTimer = setInterval(() => void backupDaily(), 5 * 60 * 1000);
backupTimer.unref();
if (process.env.POS_PARENT_PID)
  setInterval(() => {
    try {
      process.kill(Number(process.env.POS_PARENT_PID), 0);
    } catch {
      void close();
    }
  }, 2000).unref();
async function close() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
