import { Router, type RequestHandler } from 'express';
import * as controller from './reports.controller.js';
export function reportsModule(owner: RequestHandler) { const router = Router(); router.get('/reports', owner, controller.get); router.get('/reports/export', owner, controller.exportCsv); return router; }
