import type { Request, Response } from 'express';
import * as service from './sales.service.js';
export async function create(req: Request, res: Response) { res.status(201).json(await service.create(req.body, res.locals.user.name)); }
export async function list(req: Request, res: Response) { res.json(await service.list()); }
export async function returnSale(req: Request, res: Response) { res.json(await service.returnSale(req.body, String(req.params.id), res.locals.user.name)); }
