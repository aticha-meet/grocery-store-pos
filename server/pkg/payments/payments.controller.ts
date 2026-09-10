import type { Request, Response } from 'express';
import * as service from './payments.service.js';
export async function get(req: Request, res: Response) { res.json(await service.get()); }
export async function update(req: Request, res: Response) { res.json(await service.update(req.body)); }
