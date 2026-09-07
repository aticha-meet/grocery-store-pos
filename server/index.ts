import express from 'express';
import { resolve } from 'node:path';
import { app } from './app.js';
import { db } from './db.js';
import { backupDaily } from './backup.js';
await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
await db.$executeRawUnsafe('PRAGMA synchronous = FULL');
await db.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
const server = app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log(`บ้านร้าน POS: http://127.0.0.1:${process.env.PORT ?? 3001}`));
void backupDaily();
const backupTimer = setInterval(() => void backupDaily(), 5 * 60 * 1000); backupTimer.unref();
if (process.env.POS_PARENT_PID) setInterval(() => { try { process.kill(Number(process.env.POS_PARENT_PID), 0); } catch { void close(); } }, 2000).unref();
async function close() { server.close(); await db.$disconnect(); process.exit(0); }
process.on('SIGINT', close); process.on('SIGTERM', close);
