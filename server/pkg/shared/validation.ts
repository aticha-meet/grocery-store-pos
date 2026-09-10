import { z } from 'zod';
export function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
export const cents = z.number().int().min(0).max(100000000);
export const quantity = z.number().int().min(0).max(1000000);
