import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const path = resolve('prisma/demo.db');
if (!existsSync(path)) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec(readFileSync('prisma/migrations/20260907042930_init/migration.sql', 'utf8'));
  sqlite.close();
}
process.env.DATABASE_URL = 'file:' + path.replaceAll('\\', '/');
process.env.PORT = '3002';
process.env.POS_DEMO = '1';
const { db } = await import('../dist-server/server/db.js');
const { hashPassword } = await import('../dist-server/server/security.js');
const { demoProducts } = await import('../dist-server/server/demo.js');
if (!(await db.user.count())) {
  await db.$transaction(async tx => {
    await tx.user.create({ data: { name: 'เจ้าของร้าน (ทดลอง)', username: 'demo', role: 'owner', passwordHash: hashPassword('demo-store-2026') } });
    for (const p of demoProducts) await tx.product.create({ data: { ...p, movements: { create: { type: 'in', quantity: p.stockQty, note: 'ข้อมูลทดลอง', actor: 'ระบบทดลอง' } } } });
  });
}
await import('../dist-server/server/index.js');
console.log('DEMO ONLY — username: demo / password: demo-store-2026');
