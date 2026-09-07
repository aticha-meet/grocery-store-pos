import { mkdirSync, cpSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createRequire } from 'node:module';
if (process.platform !== 'win32') throw new Error('This packaging script targets Windows x64.');
const destination = resolve('src-tauri/resources');
mkdirSync(destination, { recursive: true });
for (const directory of ['dist', 'dist-server', 'desktop', 'prisma/migrations']) cpSync(directory, join(destination, directory), { recursive: true });
copyFileSync(process.execPath, join(destination, 'node.exe'));
copyFileSync('package.json', join(destination, 'package.json'));
// Copy only the production dependency closure and the generated Prisma engine.
const copied = new Set();
function copyDependency(name, parent) {
  const require = createRequire(join(parent, 'package.json'));
  let manifest;
  try { manifest = require.resolve(`${name}/package.json`); }
  catch { let folder = dirname(require.resolve(name)); while (folder !== dirname(folder)) { try { const file = join(folder, 'package.json'); if (JSON.parse(readFileSync(file, 'utf8')).name === name) { manifest = file; break; } } catch {} folder = dirname(folder); } }
  if (!manifest) throw new Error(`Unable to locate dependency ${name}`);
  const source = dirname(manifest);
  if (copied.has(source)) return;
  copied.add(source);
  const relative = source.slice(resolve('node_modules').length + 1);
  const target = join(destination, 'node_modules', relative);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true });
  for (const child of Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).dependencies ?? {})) copyDependency(child, source);
}
for (const name of ['@prisma/client', 'express', 'zod']) copyDependency(name, process.cwd());
cpSync('node_modules/.prisma', join(destination, 'node_modules/.prisma'), { recursive: true });
console.log('Desktop resources ready. No store or demo database was bundled.');
