import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
export async function create(input: unknown, actor: string) {
    const data = z
        .object({
        requestId: z.string().uuid(),
        items: z
            .array(z.object({
            productId: z.string(),
            quantity: quantity.refine((v) => v > 0),
            unitPrice: cents,
        }))
            .min(1)
            .max(200),
        discount: cents.default(0),
        paymentReceived: cents,
        paymentMethod: z.enum(["cash", "thai_help_thai"]).default("cash"),
        governmentRateBps: z.number().int().min(0).max(10000).optional(),
        assistanceConfirmed: z.boolean().default(false),
    })
        .parse(input);
    if (new Set(data.items.map((i) => i.productId)).size !== data.items.length)
        fail("รายการสินค้าซ้ำกัน");
    const result = await db.$transaction(async (tx) => {
        const existing = await tx.sale.findUnique({
            where: { requestId: data.requestId },
            include: { items: true },
        });
        if (existing)
            return existing;
        const items = [];
        let subtotal = 0;
        for (const item of data.items) {
            const product = await tx.product.findUnique({
                where: { id: item.productId },
            });
            if (!product?.active)
                fail("สินค้าถูกลบแล้ว กรุณาโหลดรายการใหม่", 409);
            if (product.sellPrice !== item.unitPrice)
                fail(`ราคา ${product.name} เปลี่ยนแล้ว กรุณานำออกและเพิ่มสินค้าใหม่`, 409);
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
            if (!update.count)
                fail("สต็อกเปลี่ยนแปลง กรุณาลองใหม่", 409);
        }
        const total = subtotal - data.discount;
        if (total < 0 || total > 100000000)
            fail("ยอดรวม/ส่วนลดอยู่นอกช่วงที่รองรับ");
        let governmentRateBps = 0;
        if (data.paymentMethod === "thai_help_thai") {
            if (!data.assistanceConfirmed)
                fail("กรุณาตรวจสอบการชำระผ่านโครงการและยืนยันก่อนบันทึก");
            governmentRateBps =
                (await tx.paymentSettings.findUnique({ where: { id: "main" } }))
                    ?.governmentRateBps ?? 5000;
            if (data.governmentRateBps !== governmentRateBps)
                fail("สัดส่วนช่วยจ่ายเปลี่ยนแล้ว กรุณาโหลดสัดส่วนล่าสุดก่อนยืนยัน", 409);
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
                cashier: actor,
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
                    actor: actor,
                },
            });
        return sale;
    });
    return result;
}
export async function list() {
    return await db.sale.findMany({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
}
export async function returnSale(input: unknown, id: string, actor: string) {
    const { reason } = z
        .object({ reason: z.string().trim().min(1).max(200) })
        .parse(input);
    const sale = await db.$transaction(async (tx) => {
        const original = await tx.sale.findUnique({
            where: { id: id },
            include: { items: true },
        });
        if (!original)
            fail("ไม่พบบิล", 404);
        if (original.returnedAt)
            fail("บิลนี้คืนสินค้าแล้ว", 409);
        await tx.sale.update({
            where: { id: original.id },
            data: {
                returnedAt: new Date(),
                returnReason: reason,
                returnedBy: actor,
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
                    actor: actor,
                },
            });
        }
        return {
            refund: original.customerAmount,
            governmentReversal: original.governmentAmount,
        };
    });
    return sale;
}
