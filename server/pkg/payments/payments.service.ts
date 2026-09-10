import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
export async function get() {
    return (await db.paymentSettings.findUnique({ where: { id: "main" } })) ?? {
        id: "main",
        governmentRateBps: 5000,
    };
}
export async function update(input: unknown) {
    const data = z
        .object({ governmentRateBps: z.number().int().min(0).max(10000) })
        .parse(input);
    return await db.paymentSettings.upsert({
        where: { id: "main" },
        create: { id: "main", ...data },
        update: data,
    });
}
