import type { Request, Response } from 'express';
import * as service from './health.service.js';
export async function check(req: Request, res: Response) { res.json(await service.check()); }
