import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
const resources = resolve('src-tauri/resources');
test('packaged Node backend migrates a clean database and retains data after abrupt exit', { skip: !existsSync(resolve(resources, 'node.exe')) }, async () => {
  const data = mkdtempSync(resolve('test-results-desktop-'));
  let child: ChildProcess | undefined;
  let logs = '';
  const start = async () => {
    child = spawn(resolve(resources, 'node.exe'), ['desktop/bootstrap.mjs'], { cwd: resources, env: { ...process.env, POS_DATA_DIR: data, PORT: '3003' }, windowsHide: true });
    child.stderr?.on('data', output => { logs += String(output); });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(logs);
      try { const health = await fetch('http://127.0.0.1:3003/api/health'); if (health.ok) return; } catch { /* wait for startup */ }
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error('Packaged server failed to start: ' + logs);
  };
  const stop = async () => { if (child && child.exitCode === null && child.signalCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; } child = undefined; };
  try {
    await start();
    let response = await fetch('http://127.0.0.1:3003/api/session'); assert.equal((await response.json()).needsSetup, true);
    response = await fetch('http://127.0.0.1:3003/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Packaged owner', username: 'packaged', password: 'test-password', demo: true }) }); assert.equal(response.status, 201);
    response = await fetch('http://127.0.0.1:3003/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'packaged', password: 'test-password' }) }); assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const products = await (await fetch('http://127.0.0.1:3003/api/products', { headers: { Cookie: cookie } })).json();
    const product = products[0];
    response = await fetch('http://127.0.0.1:3003/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ requestId: randomUUID(), items: [{ productId: product.id, quantity: 1, unitPrice: product.sellPrice }], paymentReceived: product.sellPrice }) }); assert.equal(response.status, 201);
    await stop(); await start();
    response = await fetch('http://127.0.0.1:3003/api/session'); assert.equal((await response.json()).needsSetup, false);
    await stop();
    const sqlite = new DatabaseSync(resolve(data, 'store.db'), { readOnly: true });
    assert.equal(sqlite.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM Product').get()?.count, 18);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM Sale').get()?.count, 1);
    assert.equal(sqlite.prepare('SELECT stockQty FROM Product WHERE id = ?').get(product.id)?.stockQty, product.stockQty - 1);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM _prisma_migrations').get()?.count, 1); sqlite.close();
  } finally { await stop(); }
});
