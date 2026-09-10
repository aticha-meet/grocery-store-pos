import { randomBytes } from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { z } from "zod";
import { demoProducts } from "./demo.data.js";
import { checkPassword, hashPassword } from "./password.service.js";
export type Identity = {
    id: string;
    name: string;
    role: string;
    username: string;
};
export const accountSchema = z.object({
    name: z.string().trim().min(1).max(80),
    username: z
        .string()
        .trim()
        .min(3)
        .max(40)
        .regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(8).max(128),
});
type Session = {
    user: Identity;
    expires: number;
};
export class UsersService {
    private readonly sessions = new Map<string, Session>();
    private readonly attempts = new Map<string, {
        count: number;
        since: number;
    }>();
    constructor(private readonly db: PrismaClient, private readonly env: NodeJS.ProcessEnv = process.env) { }
    private publicUser(user: Pick<User, "id" | "name" | "role" | "username">): Identity {
        return {
            id: user.id,
            name: user.name,
            role: user.role,
            username: user.username,
        };
    }
    getSession(token: string | undefined) {
        const session = token ? this.sessions.get(token) : undefined;
        if (session && session.expires > Date.now())
            return session.user;
        if (token)
            this.sessions.delete(token);
        return undefined;
    }
    async sessionStatus(token: string | undefined) {
        return {
            user: this.getSession(token) ?? null,
            needsSetup: (await this.db.user.count()) === 0,
            demo: this.env.POS_DEMO === "1",
        };
    }
    async setup(input: unknown) {
        const data = accountSchema
            .extend({ demo: z.boolean().default(false) })
            .parse(input);
        const owner = await this.db.$transaction(async (tx) => {
            if (await tx.user.count())
                throw Object.assign(new Error("ตั้งค่าร้านแล้ว กรุณาเข้าสู่ระบบ"), {
                    status: 409,
                });
            const created = await tx.user.create({
                data: {
                    name: data.name,
                    username: data.username,
                    passwordHash: hashPassword(data.password),
                    role: "owner",
                },
            });
            if (data.demo)
                for (const product of demoProducts)
                    await tx.product.create({
                        data: {
                            ...product,
                            movements: {
                                create: {
                                    type: "in",
                                    quantity: product.stockQty,
                                    note: "สต็อกเริ่มต้น • ข้อมูลตัวอย่าง",
                                    actor: data.name,
                                },
                            },
                        },
                    });
            return created;
        });
        return this.publicUser(owner);
    }
    async login(input: unknown, key: string) {
        const data = z
            .object({ username: z.string().max(40), password: z.string().max(128) })
            .parse(input);
        let attempt = this.attempts.get(key);
        if (!attempt || Date.now() - attempt.since > 60000) {
            attempt = { count: 0, since: Date.now() };
            this.attempts.set(key, attempt);
        }
        if (++attempt.count > 10)
            throw Object.assign(new Error("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 1 นาที"), {
                status: 429,
            });
        const user = await this.db.user.findUnique({
            where: { username: data.username },
        });
        if (!user || !checkPassword(data.password, user.passwordHash))
            throw Object.assign(new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"), {
                status: 401,
            });
        this.attempts.delete(key);
        const token = randomBytes(32).toString("hex");
        for (const [id, session] of this.sessions)
            if (session.expires < Date.now())
                this.sessions.delete(id);
        const identity = this.publicUser(user);
        this.sessions.set(token, {
            user: identity,
            expires: Date.now() + 12 * 60 * 60 * 1000,
        });
        return { user: identity, token };
    }
    logout(token: string | undefined) {
        if (token)
            this.sessions.delete(token);
    }
    async createCashier(input: unknown) {
        const data = accountSchema.parse(input);
        const user = await this.db.user.create({
            data: {
                name: data.name,
                username: data.username,
                passwordHash: hashPassword(data.password),
                role: "cashier",
            },
        });
        return this.publicUser(user);
    }
    async listUsers() {
        const users = await this.db.user.findMany({
            select: { id: true, name: true, username: true, role: true },
        });
        return users.map((user) => this.publicUser(user));
    }
}
