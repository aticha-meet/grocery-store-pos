import { Router, type RequestHandler } from 'express';
import * as controller from './payments.controller.js';
export function paymentsModule(owner: RequestHandler) {
    const router = Router();
    router.get("/payment-settings", controller.get);
    router.put("/payment-settings", owner, controller.update);
    return router;
}
