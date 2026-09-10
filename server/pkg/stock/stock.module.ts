import { Router, type RequestHandler } from 'express';
import * as controller from './stock.controller.js';
export function stockModule(owner: RequestHandler) {
    const router = Router();
    router.get("/stock-movements", owner, controller.list);
    router.post("/stock-movements", owner, controller.create);
    return router;
}
