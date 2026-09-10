import { existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
process.loadEnvFile(".env");
await import("./ensure-db.mjs");
for (const args of [["generate"], ["migrate", "deploy"]]) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args],
    { stdio: "inherit", env: process.env, windowsHide: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
