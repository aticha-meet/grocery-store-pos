import { PrismaClient } from "@prisma/client";
process.env.DATABASE_URL ??= "file:./store.db";
export const db = new PrismaClient();
