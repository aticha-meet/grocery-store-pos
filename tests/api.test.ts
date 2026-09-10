import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import request from "supertest";
// Each run gets its own database. Never reset or mutate a store database.
const dir = mkdtempSync(resolve("test-results-"));
process.env.DATABASE_URL = "file:" + join(dir, "test.db").replaceAll("\\", "/");
process.env.BACKUP_DIR = join(dir, "backups");
const sqlite = new DatabaseSync(join(dir, "test.db"));
for (const m of readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((m) => m.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name)))
  sqlite.exec(
    readFileSync("prisma/migrations/" + m.name + "/migration.sql", "utf8"),
  );
sqlite.close();
const { app } = await import("../server/app.js");
const { report } = await import('../server/pkg/reports/reports.service.js');
const { db } = await import("../server/pkg/database/database.service.js");
const owner = request.agent(app);
const cashier = request.agent(app);
const base = {
  name: "สินค้า A",
  barcode: "001",
  category: "ทดสอบ",
  costPrice: 105,
  sellPrice: 220,
  unit: "ชิ้น",
  stockQty: 10,
  reorderThreshold: 8,
  icon: "📦",
};
let productId = "";
let saleId = "";
before(async () => {
  await owner
    .post("/api/setup")
    .send({ name: "Owner", username: "owner", password: "test-password" })
    .expect(201);
  await owner
    .post("/api/login")
    .send({ username: "owner", password: "test-password" })
    .expect(200);
  await owner
    .post("/api/users")
    .send({ name: "Cashier", username: "cashier", password: "test-password" })
    .expect(201);
  await cashier
    .post("/api/login")
    .send({ username: "cashier", password: "test-password" })
    .expect(200);
  await db.$queryRawUnsafe("PRAGMA journal_mode = WAL");
  const p = await owner.post("/api/products").send(base).expect(201);
  productId = p.body.id;
});
after(async () => {
  await db.$disconnect();
});
test("reject unauthenticated requests, repeated setup, foreign origins and cashier stock edits", async () => {
  await request(app).get("/api/products").expect(401);
  await owner
    .post("/api/setup")
    .send({ name: "Owner", username: "owner2", password: "test-password" })
    .expect(409);
  await owner
    .post("/api/products")
    .set("Origin", "https://evil.example")
    .send(base)
    .expect(403);
  await cashier
    .post("/api/products")
    .send({ ...base, barcode: "002" })
    .expect(403);
  await cashier.get("/api/reports").expect(403);
  await cashier.post("/api/backup").expect(403);
  await owner.post("/api/products").send(base).expect(409);
});
test("public routes, user guards and session invalidation survive module composition", async () => {
  await request(app).get('/api/health').expect(200);
  const anonymous = await request(app).get('/api/session').expect(200);
  assert.equal(anonymous.body.user, null);
  assert.equal(anonymous.body.needsSetup, false);
  await request(app).get('/api/users').expect(401);
  await cashier.get('/api/users').expect(403);
  const users = await owner.get('/api/users').expect(200);
  assert.equal(users.body.length, 2);
  assert.ok(users.body.every((user: Record<string, unknown>) => !('passwordHash' in user)));
  const login = await request(app).post('/api/login')
    .send({ username: 'cashier', password: 'test-password' }).expect(200);
  const cookie = login.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const token = cookie.split(';')[0];
  const session = await request(app).get('/api/session').set('Cookie', token).expect(200);
  assert.equal(session.body.user.username, 'cashier');
  await request(app).post('/api/logout').set('Cookie', token).expect(200);
  await request(app).get('/api/products').set('Cookie', token).expect(401);
});
test("checkout uses integer money, atomic stock ledger and idempotent retry", async () => {
  const payload = {
    requestId: randomUUID(),
    items: [{ productId, quantity: 3, unitPrice: 220 }],
    discount: 11,
    paymentReceived: 1000,
  };
  const sale = await cashier.post("/api/sales").send(payload).expect(201);
  saleId = sale.body.id;
  assert.equal(sale.body.totalAmount, 649);
  assert.equal(sale.body.change, 351);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    7,
  );
  const retry = await cashier.post("/api/sales").send(payload).expect(201);
  assert.equal(retry.body.id, saleId);
  assert.equal(await db.sale.count(), 1);
  assert.equal(await db.stockMovement.count({ where: { type: "out" } }), 1);
  const alerts = await cashier.get("/api/alerts/low-stock").expect(200);
  assert.equal(alerts.body.length, 1);
});
test("insufficient cash, overselling, duplicate lines, negative quantities and stale prices leave stock intact", async () => {
  const line = { productId, quantity: 1, unitPrice: 220 };
  await owner
    .post("/api/sales")
    .send({ requestId: randomUUID(), items: [line], paymentReceived: 0 })
    .expect(400);
  await owner
    .post("/api/sales")
    .send({
      requestId: randomUUID(),
      items: [{ ...line, quantity: 8 }],
      paymentReceived: 9999,
    })
    .expect(409);
  await owner
    .post("/api/sales")
    .send({
      requestId: randomUUID(),
      items: [line, line],
      paymentReceived: 9999,
    })
    .expect(400);
  await owner
    .post("/api/sales")
    .send({
      requestId: randomUUID(),
      items: [{ ...line, quantity: -1 }],
      paymentReceived: 9999,
    })
    .expect(400);
  await owner
    .post("/api/sales")
    .send({
      requestId: randomUUID(),
      items: [{ ...line, unitPrice: 1 }],
      paymentReceived: 9999,
    })
    .expect(409);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    7,
  );
  assert.equal(await db.sale.count(), 1);
});
test("a failing second line rolls back the first stock decrement", async () => {
  const p = await owner
    .post("/api/products")
    .send({ ...base, barcode: "002", stockQty: 0 })
    .expect(201);
  await owner
    .post("/api/sales")
    .send({
      requestId: randomUUID(),
      items: [
        { productId, quantity: 1, unitPrice: 220 },
        { productId: p.body.id, quantity: 1, unitPrice: 220 },
      ],
      paymentReceived: 9999,
    })
    .expect(409);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    7,
  );
});
test("price and cost snapshots survive product edits; edit cannot bypass stock ledger", async () => {
  await owner
    .put(`/api/products/${productId}`)
    .send({ ...base, sellPrice: 500, costPrice: 300, stockQty: 999 })
    .expect(200);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    7,
  );
  const item = await db.saleItem.findFirstOrThrow({ where: { saleId } });
  assert.equal(item.unitPrice, 220);
  assert.equal(item.costPrice, 105);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const data = await report("day", date);
  assert.equal(data.total, 649);
  assert.equal(data.profit, 334);
  assert.equal(data.bills, 1);
});
test("stock adjustments reject negative balance and require an audit reason", async () => {
  await owner
    .post("/api/stock-movements")
    .send({ productId, type: "adjust", quantity: -8, note: "เสียหาย" })
    .expect(409);
  await owner
    .post("/api/stock-movements")
    .send({ productId, type: "in", quantity: -1, note: "รับเข้า" })
    .expect(400);
  await owner
    .post("/api/stock-movements")
    .send({ productId, type: "adjust", quantity: 1, note: "" })
    .expect(400);
  await owner
    .post("/api/stock-movements")
    .send({ productId, type: "in", quantity: 2, note: "รับเข้า" })
    .expect(201);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    9,
  );
});
test("returns are owner-only, restore archived products, and cannot be applied twice", async () => {
  await cashier
    .post(`/api/sales/${saleId}/return`)
    .send({ reason: "ผิดรายการ" })
    .expect(403);
  await owner.delete(`/api/products/${productId}`).expect(200);
  const refund = await owner
    .post(`/api/sales/${saleId}/return`)
    .send({ reason: "ผิดรายการ" })
    .expect(200);
  assert.equal(refund.body.refund, 649);
  await owner
    .post(`/api/sales/${saleId}/return`)
    .send({ reason: "ซ้ำ" })
    .expect(409);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stockQty,
    12,
  );
  const r = await report("year", `${new Date().getUTCFullYear()}-01-01`);
  assert.equal(r.total, 0);
  assert.equal(r.profit, 0);
  assert.equal(r.returns, 1);
});
test("reports respect Bangkok date boundaries and zero sellers; CSV downloads", async () => {
  await db.sale.create({
    data: {
      requestId: randomUUID(),
      totalAmount: 300,
      paymentReceived: 300,
      change: 0,
      cashier: "Test",
      createdAt: new Date("2024-12-31T17:00:00Z"),
    },
  });
  assert.equal((await report("day", "2025-01-01")).total, 300);
  assert.equal((await report("day", "2024-12-31")).total, 0);
  assert.equal((await report("month", "2025-01-01")).total, 300);
  assert.equal((await report("year", "2025-01-01")).total, 300);
  const r = await report("day", "2025-01-01");
  assert.ok(r.bottom.some((p) => p.quantity === 0));
  assert.equal(r.chart[0].amount, 3);
  const csv = await owner
    .get("/api/reports/export?period=day&date=2025-01-01")
    .expect(200);
  assert.match(csv.headers["content-type"], /text\/csv/);
  assert.match(csv.text, /2025-01-01,3,1,3,0/);
});
test("month boundaries include March 31 and leap day without including next month", async () => {
  for (const date of [
    "2024-02-29T16:59:59Z",
    "2025-03-31T16:59:59Z",
    "2025-03-31T17:00:00Z",
  ])
    await db.sale.create({
      data: {
        requestId: randomUUID(),
        totalAmount: 111,
        paymentReceived: 111,
        change: 0,
        cashier: "Test",
        createdAt: new Date(date),
      },
    });
  const feb = await report("month", "2024-02-01");
  assert.equal(feb.total, 111);
  assert.equal(feb.chart.length, 29);
  const march = await report("month", "2025-03-01");
  assert.equal(march.total, 111);
  assert.equal(march.chart[30].amount, 1.11);
  assert.equal((await report("month", "2025-04-01")).total, 111);
  await owner.get("/api/reports?period=day&date=2025-02-30").expect(400);
});
test("live backup is a readable consistent SQLite snapshot", async () => {
  const result = await owner.post("/api/backup").send({}).expect(200);
  const backup = new DatabaseSync(result.body.path, { readOnly: true });
  assert.equal(
    (backup.prepare("PRAGMA integrity_check").get() as Record<string, unknown>)
      .integrity_check,
    "ok",
  );
  assert.equal(
    (
      backup.prepare("SELECT count(*) AS count FROM Sale").get() as Record<
        string,
        unknown
      >
    ).count,
    await db.sale.count(),
  );
  backup.close();
});
