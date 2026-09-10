import type { Request, Response } from 'express';
import * as service from './products.service.js';
export async function list(req: Request, res: Response) { res.json(await service.list()); }
export async function lowStock(req: Request, res: Response) { res.json(await service.lowStock()); }
export async function create(req: Request, res: Response) { res.status(201).json(await service.create(req.body, res.locals.user.name)); }
export async function update(req: Request, res: Response) { res.json(await service.update(req.body, String(req.params.id))); }
export async function remove(req: Request, res: Response) { res.json(await service.remove(String(req.params.id))); }
