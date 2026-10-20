import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../src/app.js';

describe('TripZa Backend Foundation & Health Suite', () => {
  it('GET /api/health should respond with 200 and accurate system status', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data);
    assert.ok(['ok', 'degraded'].includes(res.body.data.status));
    assert.strictEqual(res.body.data.service, 'tripza-backend');
    assert.strictEqual(typeof res.body.data.uptimeSeconds, 'number');
    assert.strictEqual(res.body.data.server.status, 'healthy');

    // Honest database reporting:
    assert.ok(res.body.data.database);
    assert.ok(typeof res.body.data.database.status === 'string');
    assert.ok(typeof res.body.data.database.message === 'string');
  });

  it('GET /api should respond with 200 and API metadata', async () => {
    const res = await request(app)
      .get('/api')
      .expect('Content-Type', /json/)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'TripZa API');
    assert.ok(res.body.data.endpoints.health);
  });

  it('GET /api/nonexistent-route should respond with 404 and consistent error format', async () => {
    const res = await request(app)
      .get('/api/nonexistent-route')
      .expect('Content-Type', /json/)
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.includes('NOT_FOUND') || res.body.error.message.includes('does not exist'));
  });

  it('Should set security headers via Helmet', async () => {
    const res = await request(app).get('/api/health');

    // Check Helmet security headers
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['content-security-policy']);
  });
});
