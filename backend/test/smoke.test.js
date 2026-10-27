const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { app } = require('../src/server');

test('Express Server Smoke Tests', async (t) => {
  let server;
  let baseUrl;

  await t.test('Start test server on random port', async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  await t.test('GET /api/health should respond with json', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    assert.ok(data);
    assert.ok(data.gateway);
    assert.strictEqual(data.gateway, 'Express.js Backend');
  });

  await t.test('POST /api/predict without file should return 400', async () => {
    const res = await fetch(`${baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  await t.test('Close test server', async () => {
    await new Promise((resolve) => server.close(resolve));
  });
});
