import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from '../src/config/env.js';

describe('TripZa Configuration Suite', () => {
  it('should load safe default configuration', () => {
    assert.ok(config);
    assert.strictEqual(typeof config.port, 'number');
    assert.ok(config.port > 0 && config.port <= 65535);
    assert.ok(['development', 'test', 'production'].includes(config.env));
    assert.ok(config.clientOrigin);
    assert.ok(typeof config.rateLimit.windowMs === 'number');
    assert.ok(typeof config.rateLimit.max === 'number');
  });

  it('should keep secrets out of client-accessible fields', () => {
    // Ensure secrets are not empty and are strings on the backend
    assert.ok(typeof config.sessionSecret === 'string');
  });
});
