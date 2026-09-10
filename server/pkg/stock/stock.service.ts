import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
export async function list() {
    return await db.stockMovement.findMany({
        include: { product: { select: { name: true, unit: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
    });
}
export async function create(input: unknown, actor: string) {
    const data = z
        .object({
        productId: z.string(),
        type: z.enum(["in", "adjust"]),
        quantity: z
            .number()
            .int()
            .min(-1000000)
            .max(1000000)
            .refine((v) => v !== 0),
        note: z.string().trim().min(1).max(200),
    })
        .parse(input);
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
        if (!changed.count)
            fail("ไม่พบสินค้า หรือสต็อกไม่เพียงพอ", 409);
        return tx.stockMovement.create({
            data: { ...data, actor: actor },
        });
    });
    return result;
}
