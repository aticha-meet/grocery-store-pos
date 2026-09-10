import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
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
export async function list() {
    return await db.product.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
    });
}
export async function lowStock() {
    const all = await db.product.findMany({ where: { active: true } });
    return all.filter((p) => p.stockQty === 0 || p.stockQty < p.reorderThreshold);
}
export async function create(input: unknown, actor: string) {
    const data = productSchema.parse(input);
    return await db.product.create({
        data: {
            ...data,
            movements: {
                create: {
                    type: "in",
                    quantity: data.stockQty,
                    note: "สต็อกเริ่มต้น",
                    actor: actor,
                },
            },
        },
    });
}
export async function update(input: unknown, id: string) {
    const data = productSchema.omit({ stockQty: true }).parse(input);
    return await db.product.update({
        where: { id: id, active: true },
        data,
    });
}
export async function remove(id: string) {
    await db.product.update({
        where: { id: id },
        data: { active: false },
    });
    return { ok: true };
}
