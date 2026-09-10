import type { Request, Response } from 'express';
import * as service from './backup.service.js';
export async function create(req: Request, res: Response) { res.json(await service.create()); }
export async function status(req: Request, res: Response) { res.json(await service.status()); }
