import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { registerHttp } from '../server/pkg/http/http.module.js';

const host = 'grocery-pos.edflow.online';
const origin = `https://${host}`;
function server(env: NodeJS.ProcessEnv = {}) {
  const app = express();
  registerHttp(app, env);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', (_req, res) => res.sendStatus(401));
  return app;
}
test('tunnel host requires configuration and works without an Origin header', async () => {
  await request(server()).get('/api/health').set('Host', host).expect(403);
  await request(server({ PD_HOSTNAME: origin })).get('/api/health').set('Host', host).expect(200);
  await request(server()).get('/api/health').expect(200);
});
test('allowed origins receive credential CORS headers including on authentication errors', async () => {
  const app = server({ PD_HOSTNAME: origin, CORS_ORIGINS: 'https://frontend.example' });
  for (const source of [origin, 'https://frontend.example', 'http://localhost:5173']) {
    const result = await request(app).get('/api/private').set('Host', host).set('Origin', source).expect(401);
    assert.equal(result.headers['access-control-allow-origin'], source);
    assert.equal(result.headers['access-control-allow-credentials'], 'true');
    assert.match(result.headers.vary, /Origin/);
  }
});
test('preflight is handled before authentication and restricts methods and headers', async () => {
  const app = server({ PD_HOSTNAME: origin });
  await request(app).options('/api/sales').set('Host', host).set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Content-Type').expect(204);
  await request(app).options('/api/sales').set('Host', host).set('Origin', origin)
    .set('Access-Control-Request-Method', 'PATCH').expect(403);
  await request(app).options('/api/sales').set('Host', host).set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'X-Untrusted').expect(403);
});
test('foreign origins, hosts and forwarded host spoofing remain blocked', async () => {
  const app = server({ PD_HOSTNAME: origin, CORS_ORIGINS: 'https://frontend.example' });
  const result = await request(app).get('/api/health').set('Host', host).set('Origin', 'https://evil.example').expect(403);
  assert.equal(result.headers['access-control-allow-origin'], undefined);
  await request(app).get('/api/health').set('Host', 'frontend.example').expect(403);
  await request(app).get('/api/health').set('Host', 'evil.example').set('X-Forwarded-Host', host).expect(403);
});
