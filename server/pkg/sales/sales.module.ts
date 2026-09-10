import { Router, type RequestHandler } from 'express';
import * as controller from './sales.controller.js';
export function salesModule(owner: RequestHandler) {
    const router = Router();
    router.post("/sales", controller.create);
    router.get("/sales", controller.list);
    router.post("/sales/:id/return", owner, controller.returnSale);
    return router;
}
