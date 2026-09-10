import { db } from "../database/database.service.js";
import { z } from "zod";
import { fail, cents, quantity } from "../shared/validation.js";
export async function check() {
    await db.$queryRaw `SELECT 1`;
    return { ok: true };
}
