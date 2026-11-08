const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

test('CORS and Security Headers Verification', async (t) => {
  let server;
  let baseUrl;

  await t.test('Start test server on random port', async () => {
    await connectDB();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  await t.test('OPTIONS /api/history returns 204 and permits x-target-patient-id from http://localhost:5173', async () => {
    const res = await fetch(`${baseUrl}/api/history`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type, authorization, x-target-patient-id',
      },
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const allowHeaders = res.headers.get('access-control-allow-headers') || '';
    assert.ok(allowHeaders.toLowerCase().includes('x-target-patient-id'));
    assert.ok(allowHeaders.toLowerCase().includes('authorization'));
    assert.ok(allowHeaders.toLowerCase().includes('content-type'));
  });

  await t.test('OPTIONS /api/patients/me returns 204 and permits x-target-patient-id from http://localhost:5173', async () => {
    const res = await fetch(`${baseUrl}/api/patients/me`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type, authorization, x-target-patient-id',
      },
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const allowHeaders = res.headers.get('access-control-allow-headers') || '';
    assert.ok(allowHeaders.toLowerCase().includes('x-target-patient-id'));
  });

  await t.test('OPTIONS /api/predict returns 204 and permits x-target-patient-id from http://localhost:5173', async () => {
    const res = await fetch(`${baseUrl}/api/predict`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, x-target-patient-id',
      },
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const allowHeaders = res.headers.get('access-control-allow-headers') || '';
    assert.ok(allowHeaders.toLowerCase().includes('x-target-patient-id'));
  });

  await t.test('Disallowed origins are rejected by CORS', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': 'http://unauthorized-domain.com',
      },
    });
    // CORS middleware invokes callback with error resulting in 500 or CORS failure
    assert.notStrictEqual(res.headers.get('access-control-allow-origin'), 'http://unauthorized-domain.com');
  });

  await t.test('Ordinary patient attempting to access another patient record returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/patients/me`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer patient-demo-1',
        'x-target-patient-id': 'patient-demo-2',
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Access denied'));
  });

  await t.test('Close test server', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
