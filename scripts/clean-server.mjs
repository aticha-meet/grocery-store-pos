import { rmSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, 'dist-server');
const within = relative(root, target);
if (within !== 'dist-server' || isAbsolute(within)) throw new Error('Invalid build output path');
rmSync(target, { recursive: true, force: true });
