import express from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { checkPassword, hashPassword } from "./security.js";
import { demoProducts } from "./demo.js";
import { createBackup, backupState } from "./backup.js";

export const app = express();
const env = process.env;

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  next();
});

app.use(express.json({ limit: "100kb" }));
type Identity = { id: string; name: string; role: string; username: string };
const sessions = new Map<string, { user: Identity; expires: number }>();
const cookieName = `pos_session_${env.PORT ?? 3001}`;
const sessionToken = (req: express.Request) =>
  req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
const attempts = new Map<string, { count: number; since: number }>();
const publicUser = (u: Identity): Identity => ({
  id: u.id,
  name: u.name,
  role: u.role,
  username: u.username,
});
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

const cents = z.number().int().min(0).max(100_000_000);
const quantity = z.number().int().min(0).max(1_000_000);
const account = z.object({
  name: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
});

const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  barcode: z.string().trim().min(1).max(64),
  category: z.string().trim().min(1).max(60),
  costPrice: cents,
  sellPrice: cents,
  unit: z.string().trim().min(1).max(30),
  stockQty: quantity,
  reorderThreshold: quantity,
  icon: z.string().max(12).default("📦"),
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.get("origin");
  if (
    origin &&
    ![
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      `http://127.0.0.1:${env.PORT ?? 3001}`,
      `http://localhost:${env.PORT ?? 3001}`,
      `${env.PD_HOSTNAME}`,
    ].includes(origin)
  )
    return res.status(403).json({ error: "ไม่อนุญาตให้เข้าถึงจากเว็บไซต์นี้" });
  if (!["127.0.0.1", "localhost"].includes(req.hostname))
    return res.status(403).json({ error: "เปิดแอปผ่าน localhost เท่านั้น" });
  const token = sessionToken(req);
  const session = token ? sessions.get(token) : undefined;
  if (session && session.expires > Date.now()) res.locals.user = session.user;
  else if (token) sessions.delete(token);
  next();
});
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});
app.get("/api/session", async (_req, res) =>
  res.json({
    user: res.locals.user ?? null,
    needsSetup: (await db.user.count()) === 0,
    demo: process.env.POS_DEMO === "1",
  }),
);
app.post("/api/setup", async (req, res) => {
  const data = account
    .extend({ demo: z.boolean().default(false) })
    .parse(req.body);
  const user = await db.$transaction(async (tx) => {
    if (await tx.user.count()) fail("ตั้งค่าร้านแล้ว กรุณาเข้าสู่ระบบ", 409);
    const owner = await tx.user.create({
      data: {
        name: data.name,
        username: data.username,
        passwordHash: hashPassword(data.password),
        role: "owner",
      },
    });
    if (data.demo)
      for (const p of demoProducts)
        await tx.product.create({
          data: {
            ...p,
            movements: {
              create: {
                type: "in",
                quantity: p.stockQty,
                note: "สต็อกเริ่มต้น • ข้อมูลตัวอย่าง",
                actor: data.name,
              },
            },
          },
        });
    return owner;
  });
  res.status(201).json({ user: publicUser(user) });
});
app.post("/api/login", async (req, res) => {
  const data = z
    .object({ username: z.string().max(40), password: z.string().max(128) })
    .parse(req.body);
  const key = req.ip ?? "local";
  let attempt = attempts.get(key);
  if (!attempt || Date.now() - attempt.since > 60_000) {
    attempt = { count: 0, since: Date.now() };
    attempts.set(key, attempt);
  }
  if (++attempt.count > 10)
    fail("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 1 นาที", 429);
  const user = await db.user.findUnique({ where: { username: data.username } });
  if (!user || !checkPassword(data.password, user.passwordHash))
    fail("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
  attempts.delete(key);
  const token = randomBytes(32).toString("hex");
  for (const [id, session] of sessions)
    if (session.expires < Date.now()) sessions.delete(id);
  sessions.set(token, {
    user: publicUser(user),
    expires: Date.now() + 12 * 60 * 60 * 1000,
  });
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ user: publicUser(user) });
});
app.post("/api/logout", (req, res) => {
  const token = sessionToken(req);
  if (token) sessions.delete(token);
  res.clearCookie(cookieName);
  res.json({ ok: true });
});
app.use("/api", (_req, res, next) => {
  if (!res.locals.user)
    return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  next();
});
const owner: express.RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== "owner")
    return res.status(403).json({ error: "เฉพาะเจ้าของร้านเท่านั้น" });
  next();
};
app.post("/api/users", owner, async (req, res) => {
  const data = account.parse(req.body);
  const user = await db.user.create({
    data: {
      name: data.name,
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: "cashier",
    },
  });
  res.status(201).json(publicUser(user));
});
app.get("/api/users", owner, async (_req, res) =>
  res.json(
    await db.user.findMany({
      select: { id: true, name: true, username: true, role: true },
    }),
  ),
);
app.get("/api/products", async (_req, res) =>
  res.json(
    await db.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ),
);
app.get("/api/alerts/low-stock", async (_req, res) => {
  const all = await db.product.findMany({ where: { active: true } });
  res.json(
    all.filter((p) => p.stockQty === 0 || p.stockQty < p.reorderThreshold),
  );
});
app.post("/api/products", owner, async (req, res) => {
  const data = productSchema.parse(req.body);
  res.status(201).json(
    await db.product.create({
      data: {
        ...data,
        movements: {
          create: {
            type: "in",
            quantity: data.stockQty,
            note: "สต็อกเริ่มต้น",
            actor: res.locals.user.name,
          },
        },
      },
    }),
  );
});
app.put("/api/products/:id", owner, async (req, res) => {
  const data = productSchema.omit({ stockQty: true }).parse(req.body);
  res.json(
    await db.product.update({
      where: { id: String(req.params.id), active: true },
      data,
    }),
  );
});
app.delete("/api/products/:id", owner, async (req, res) => {
  await db.product.update({
    where: { id: String(req.params.id) },
    data: { active: false },
  });
  res.json({ ok: true });
});
app.get("/api/stock-movements", owner, async (_req, res) =>
  res.json(
    await db.stockMovement.findMany({
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ),
);
app.post("/api/stock-movements", owner, async (req, res) => {
  const data = z
    .object({
      productId: z.string(),
      type: z.enum(["in", "adjust"]),
      quantity: z
        .number()
        .int()
        .min(-1_000_000)
        .max(1_000_000)
        .refine((v) => v !== 0),
      note: z.string().trim().min(1).max(200),
    })
    .parse(req.body);
  if (data.type === "in" && data.quantity < 0)
    fail("จำนวนรับเข้าต้องมากกว่า 0");
  const result = await db.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({
      where: {
        id: data.productId,
        active: true,
        ...(data.quantity < 0 ? { stockQty: { gte: -data.quantity } } : {}),
      },
      data: { stockQty: { increment: data.quantity } },
    });
    if (!changed.count) fail("ไม่พบสินค้า หรือสต็อกไม่เพียงพอ", 409);
    return tx.stockMovement.create({
      data: { ...data, actor: res.locals.user.name },
    });
  });
  res.status(201).json(result);
});
app.get("/api/payment-settings", async (_req, res) =>
  res.json(
    (await db.paymentSettings.findUnique({ where: { id: "main" } })) ?? {
      id: "main",
      governmentRateBps: 5000,
    },
  ),
);
app.put("/api/payment-settings", owner, async (req, res) => {
  const data = z
    .object({ governmentRateBps: z.number().int().min(0).max(10000) })
    .parse(req.body);
  res.json(
    await db.paymentSettings.upsert({
      where: { id: "main" },
      create: { id: "main", ...data },
      update: data,
    }),
  );
});
app.post("/api/sales", async (req, res) => {
  const data = z
    .object({
      requestId: z.string().uuid(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            quantity: quantity.refine((v) => v > 0),
            unitPrice: cents,
          }),
        )
        .min(1)
        .max(200),
      discount: cents.default(0),
      paymentReceived: cents,
      paymentMethod: z.enum(["cash", "thai_help_thai"]).default("cash"),
      governmentRateBps: z.number().int().min(0).max(10000).optional(),
      assistanceConfirmed: z.boolean().default(false),
    })
    .parse(req.body);
  if (new Set(data.items.map((i) => i.productId)).size !== data.items.length)
    fail("รายการสินค้าซ้ำกัน");
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.sale.findUnique({
      where: { requestId: data.requestId },
      include: { items: true },
    });
    if (existing) return existing;
    const items = [];
    let subtotal = 0;
    for (const item of data.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      if (!product?.active) fail("สินค้าถูกลบแล้ว กรุณาโหลดรายการใหม่", 409);
      if (product.sellPrice !== item.unitPrice)
        fail(
          `ราคา ${product.name} เปลี่ยนแล้ว กรุณานำออกและเพิ่มสินค้าใหม่`,
          409,
        );
      if (product.stockQty < item.quantity)
        fail(`สต็อก ${product.name} ไม่เพียงพอ`, 409);
      const amount = product.sellPrice * item.quantity;
      subtotal += amount;
      items.push({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: item.quantity,
        unitPrice: product.sellPrice,
        costPrice: product.costPrice,
        subtotal: amount,
      });
      const update = await tx.product.updateMany({
        where: { id: product.id, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (!update.count) fail("สต็อกเปลี่ยนแปลง กรุณาลองใหม่", 409);
    }
    const total = subtotal - data.discount;
    if (total < 0 || total > 100_000_000)
      fail("ยอดรวม/ส่วนลดอยู่นอกช่วงที่รองรับ");
    let governmentRateBps = 0;
    if (data.paymentMethod === "thai_help_thai") {
      if (!data.assistanceConfirmed)
        fail("กรุณาตรวจสอบการชำระผ่านโครงการและยืนยันก่อนบันทึก");
      governmentRateBps =
        (await tx.paymentSettings.findUnique({ where: { id: "main" } }))
          ?.governmentRateBps ?? 5000;
      if (data.governmentRateBps !== governmentRateBps)
        fail(
          "สัดส่วนช่วยจ่ายเปลี่ยนแล้ว กรุณาโหลดสัดส่วนล่าสุดก่อนยืนยัน",
          409,
        );
    }
    const governmentAmount = Math.round((total * governmentRateBps) / 10000);
    const customerAmount = total - governmentAmount;
    if (data.paymentReceived < customerAmount)
      fail("จำนวนเงินที่รับจากลูกค้าไม่เพียงพอ");
    const sale = await tx.sale.create({
      data: {
        requestId: data.requestId,
        totalAmount: total,
        discount: data.discount,
        paymentReceived: data.paymentReceived,
        change: data.paymentReceived - customerAmount,
        paymentMethod: data.paymentMethod,
        governmentRateBps,
        governmentAmount,
        customerAmount,
        cashier: res.locals.user.name,
        items: { create: items },
      },
      include: { items: true },
    });
    for (const item of items)
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "out",
          quantity: -item.quantity,
          note: `ขาย #${sale.id}`,
          actor: res.locals.user.name,
        },
      });
    return sale;
  });
  res.status(201).json(result);
});
app.get("/api/sales", async (_req, res) =>
  res.json(
    await db.sale.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
);
app.post("/api/sales/:id/return", owner, async (req, res) => {
  const { reason } = z
    .object({ reason: z.string().trim().min(1).max(200) })
    .parse(req.body);
  const sale = await db.$transaction(async (tx) => {
    const original = await tx.sale.findUnique({
      where: { id: String(req.params.id) },
      include: { items: true },
    });
    if (!original) fail("ไม่พบบิล", 404);
    if (original.returnedAt) fail("บิลนี้คืนสินค้าแล้ว", 409);
    await tx.sale.update({
      where: { id: original.id },
      data: {
        returnedAt: new Date(),
        returnReason: reason,
        returnedBy: res.locals.user.name,
      },
    });
    for (const item of original.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "return",
          quantity: item.quantity,
          note: `คืน #${original.id}: ${reason}`,
          actor: res.locals.user.name,
        },
      });
    }
    return {
      refund: original.customerAmount,
      governmentReversal: original.governmentAmount,
    };
  });
  res.json(sale);
});
function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export async function report(period: string, date: string) {
  if (
    !["day", "month", "year"].includes(period) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail("ช่วงวันที่ไม่ถูกต้อง");
  const prefix = date.slice(
    0,
    period === "day" ? 10 : period === "month" ? 7 : 4,
  );
  const first =
    period === "year"
      ? `${prefix}-01-01`
      : period === "month"
        ? `${prefix}-01`
        : date;
  const from = new Date(`${first}T00:00:00+07:00`);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const until =
    period === "day"
      ? new Date(from.getTime() + 86_400_000)
      : new Date(
          Date.UTC(
            period === "year" ? year + 1 : year,
            period === "year" ? 0 : month,
            1,
          ) -
            7 * 3_600_000,
        );
  const sales = await db.sale.findMany({
    where: { createdAt: { gte: from, lt: until } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  const valid = sales.filter((s) => !s.returnedAt);
  const buckets: Record<string, number> = {};
  const count =
    period === "day"
      ? 24
      : period === "month"
        ? new Date(
            Number(date.slice(0, 4)),
            Number(date.slice(5, 7)),
            0,
          ).getDate()
        : 12;
  for (let i = 0; i < count; i++)
    buckets[
      period === "day"
        ? `${String(i).padStart(2, "0")}:00`
        : String(i + 1).padStart(2, "0")
    ] = 0;
  const sellers = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const p of await db.product.findMany({ where: { active: true } }))
    sellers.set(p.id, { name: p.name, quantity: 0, revenue: 0 });
  for (const s of valid) {
    const key =
      period === "day"
        ? new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hourCycle: "h23",
            timeZone: "Asia/Bangkok",
          }).format(s.createdAt) + ":00"
        : dateKey(s.createdAt).slice(
            period === "month" ? 8 : 5,
            period === "month" ? 10 : 7,
          );
    buckets[key] = (buckets[key] ?? 0) + s.totalAmount;
    for (const i of s.items) {
      const row = sellers.get(i.productId) ?? {
        name: i.name,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += i.quantity;
      row.revenue += i.subtotal;
      sellers.set(i.productId, row);
    }
  }
  const ranked = [...sellers.values()].sort((a, b) => b.quantity - a.quantity);
  return {
    customerTotal: valid.reduce((sum, sale) => sum + sale.customerAmount, 0),
    governmentTotal: valid.reduce(
      (sum, sale) => sum + sale.governmentAmount,
      0,
    ),
    total: valid.reduce((v, s) => v + s.totalAmount, 0),
    bills: valid.length,
    profit: valid.reduce(
      (v, s) =>
        v +
        s.totalAmount -
        s.items.reduce((c, i) => c + i.costPrice * i.quantity, 0),
      0,
    ),
    returns: sales.filter((s) => s.returnedAt).length,
    chart: Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, amount]) => ({ label, amount: amount / 100 })),
    top: ranked.filter((p) => p.quantity > 0).slice(0, 5),
    bottom: [...ranked].reverse().slice(0, 5),
  };
}
app.get("/api/reports", owner, async (req, res) =>
  res.json(
    await report(
      String(req.query.period ?? "day"),
      String(req.query.date ?? dateKey(new Date())),
    ),
  ),
);
app.get("/api/reports/export", owner, async (req, res) => {
  const period = String(req.query.period ?? "day");
  const date = String(req.query.date ?? dateKey(new Date()));
  const data = await report(period, date);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="sales-${period}-${date}.csv"`,
  );
  res.send(
    "\uFEFFช่วงเวลา,ยอดขายสุทธิ (บาท),จำนวนบิล,กำไรขั้นต้น (บาท),บิลคืน\r\n" +
      `${date},${data.total / 100},${data.bills},${data.profit / 100},${data.returns}\r\n\r\nช่วง,ยอดขาย (บาท)\r\n` +
      data.chart.map((p) => `${p.label},${p.amount}`).join("\r\n") +
      `\r\n\r\nผู้ชำระ,ยอด (บาท)\r\nลูกค้า,${data.customerTotal / 100}\r\nรัฐช่วยจ่าย,${data.governmentTotal / 100}\r\n`,
  );
});
app.post("/api/backup", owner, async (_req, res) => {
  res.json(await createBackup());
});
app.get("/api/backup/status", owner, (_req, res) => res.json(backupState));
app.use("/api", (_req, res) => res.status(404).json({ error: "ไม่พบ API" }));
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error:
          "ข้อมูลไม่ถูกต้อง: " +
          err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return res
          .status(409)
          .json({ error: "บาร์โค้ดหรือชื่อผู้ใช้ซ้ำ กรุณาตรวจสอบ" });
      if (err.code === "P2025")
        return res.status(404).json({ error: "ไม่พบข้อมูล" });
      if (["P2034", "P1008"].includes(err.code))
        return res
          .status(409)
          .json({ error: "ฐานข้อมูลกำลังทำงาน กรุณาลองอีกครั้ง" });
    }
    const e = err as Error & { status?: number };
    if (!e.status) console.error(err);
    res.status(e.status ?? 500).json({
      error: e.status
        ? e.message
        : "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่",
    });
  },
);
