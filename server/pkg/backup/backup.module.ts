import { Router, type RequestHandler } from 'express';
import * as controller from './backup.controller.js';
export function backupModule(owner: RequestHandler) {
    const router = Router();
    router.post("/backup", owner, controller.create);
    router.get("/backup/status", owner, controller.status);
    return router;
}
