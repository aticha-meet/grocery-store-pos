import { Router, type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";
export type UsersModuleOptions = {
    db: PrismaClient;
    env?: NodeJS.ProcessEnv;
};
export class UsersModule {
    readonly service: UsersService;
    readonly controller: UsersController;
    readonly router: Router;
    constructor(options: UsersModuleOptions) {
        this.service = new UsersService(options.db, options.env);
        this.controller = new UsersController(this.service, `pos_session_${(options.env ?? process.env).PORT ?? 3001}`);
        this.router = Router();
        this.router.get("/session", this.controller.session);
        this.router.post("/setup", this.controller.setup);
        this.router.post("/login", this.controller.login);
        this.router.post("/logout", this.controller.logout);
        this.router.post("/users", this.controller.ownerOnly, this.controller.create);
        this.router.get("/users", this.controller.ownerOnly, this.controller.list);
    }
    register(app: Express, prefix = "/api") {
        app.use(prefix, this.controller.attachSession, this.router);
    }
}
