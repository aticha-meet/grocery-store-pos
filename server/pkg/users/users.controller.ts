import type { NextFunction, Request, Response } from "express";
import { UsersService } from "./users.service.js";
export class UsersController {
    constructor(private readonly service: UsersService, private readonly cookieName: string) { }
    private sessionToken(req: Request) {
        return req.headers.cookie
            ?.split(";")
            .map((cookie) => cookie.trim())
            .find((cookie) => cookie.startsWith(`${this.cookieName}=`))
            ?.slice(this.cookieName.length + 1);
    }
    readonly attachSession = (req: Request, res: Response, next: NextFunction) => {
        const user = this.service.getSession(this.sessionToken(req));
        if (user)
            res.locals.user = user;
        next();
    };
    readonly requireAuth = (_req: Request, res: Response, next: NextFunction) => {
        if (!res.locals.user) {
            res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
            return;
        }
        next();
    };
    readonly ownerOnly = (_req: Request, res: Response, next: NextFunction) => {
        if (!res.locals.user)
            return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
        if (res.locals.user.role !== "owner")
            return res.status(403).json({ error: "เฉพาะเจ้าของร้านเท่านั้น" });
        next();
    };
    readonly session = async (req: Request, res: Response) => {
        res.json(await this.service.sessionStatus(this.sessionToken(req)));
    };
    readonly setup = async (req: Request, res: Response) => {
        res.status(201).json({ user: await this.service.setup(req.body) });
    };
    readonly login = async (req: Request, res: Response) => {
        const { user, token } = await this.service.login(req.body, req.ip ?? 'local');
        res.cookie(this.cookieName, token, { httpOnly: true, sameSite: 'strict', maxAge: 12 * 60 * 60 * 1000, path: '/' });
        res.json({ user });
    };
    readonly logout = (req: Request, res: Response) => {
        this.service.logout(this.sessionToken(req));
        res.clearCookie(this.cookieName);
        res.json({ ok: true });
    };
    readonly create = async (req: Request, res: Response) => {
        res.status(201).json(await this.service.createCashier(req.body));
    };
    readonly list = async (_req: Request, res: Response) => {
        res.json(await this.service.listUsers());
    };
}
