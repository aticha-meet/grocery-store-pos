import { Router, type RequestHandler } from 'express';
import * as controller from './products.controller.js';
export function productsModule(owner: RequestHandler) {
    const router = Router();
    router.get("/products", controller.list);
    router.get("/alerts/low-stock", controller.lowStock);
    router.post("/products", owner, controller.create);
    router.put("/products/:id", owner, controller.update);
    router.delete("/products/:id", owner, controller.remove);
    return router;
}
