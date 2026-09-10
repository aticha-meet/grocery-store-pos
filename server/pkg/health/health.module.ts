import { Router } from 'express';
import * as controller from './health.controller.js';
export function healthModule() {
    const router = Router();
    router.get("/health", controller.check);
    return router;
}
