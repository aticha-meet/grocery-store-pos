import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Create the empty file first: required by Prisma 6 schema engine on this Windows host.
const url = process.env.DATABASE_URL ?? 'file:./store.db';
if (!url.startsWith('file:')) throw new Error('SQLite file: URL required');
const filename = url.slice(5);
const path = /^[A-Za-z]:[\\/]/.test(filename) || filename.startsWith('/') ? filename : resolve('prisma', filename);
mkdirSync(dirname(path), { recursive: true });
new DatabaseSync(path).close();
console.log('SQLite ready:', path);
