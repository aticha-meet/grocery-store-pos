import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
export function dateKey(date: Date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}
export async function report(period: string, date: string) {
    if (!["day", "month", "year"].includes(period) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
        fail("ช่วงวันที่ไม่ถูกต้อง");
    const prefix = date.slice(0, period === "day" ? 10 : period === "month" ? 7 : 4);
    const first = period === "year"
        ? `${prefix}-01-01`
        : period === "month"
            ? `${prefix}-01`
            : date;
    const from = new Date(`${first}T00:00:00+07:00`);
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const until = period === "day"
        ? new Date(from.getTime() + 86400000)
        : new Date(Date.UTC(period === "year" ? year + 1 : year, period === "year" ? 0 : month, 1) -
            7 * 3600000);
    const sales = await db.sale.findMany({
        where: { createdAt: { gte: from, lt: until } },
        include: { items: true },
        orderBy: { createdAt: "asc" },
    });
    const valid = sales.filter((s) => !s.returnedAt);
    const buckets: Record<string, number> = {};
    const count = period === "day"
        ? 24
        : period === "month"
            ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()
            : 12;
    for (let i = 0; i < count; i++)
        buckets[period === "day"
            ? `${String(i).padStart(2, "0")}:00`
            : String(i + 1).padStart(2, "0")] = 0;
    const sellers = new Map<string, {
        name: string;
        quantity: number;
        revenue: number;
    }>();
    for (const p of await db.product.findMany({ where: { active: true } }))
        sellers.set(p.id, { name: p.name, quantity: 0, revenue: 0 });
    for (const s of valid) {
        const key = period === "day"
            ? new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                hourCycle: "h23",
                timeZone: "Asia/Bangkok",
            }).format(s.createdAt) + ":00"
            : dateKey(s.createdAt).slice(period === "month" ? 8 : 5, period === "month" ? 10 : 7);
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
        governmentTotal: valid.reduce((sum, sale) => sum + sale.governmentAmount, 0),
        total: valid.reduce((v, s) => v + s.totalAmount, 0),
        bills: valid.length,
        profit: valid.reduce((v, s) => v +
            s.totalAmount -
            s.items.reduce((c, i) => c + i.costPrice * i.quantity, 0), 0),
        returns: sales.filter((s) => s.returnedAt).length,
        chart: Object.entries(buckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, amount]) => ({ label, amount: amount / 100 })),
        top: ranked.filter((p) => p.quantity > 0).slice(0, 5),
        bottom: [...ranked].reverse().slice(0, 5),
    };
}
