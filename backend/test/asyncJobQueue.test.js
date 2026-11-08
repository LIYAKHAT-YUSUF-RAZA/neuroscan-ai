const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const InferenceJob = require('../src/models/InferenceJob');
const Patient = require('../src/models/Patient');
const { signToken } = require('../src/middlewares/auth');

describe('Asynchronous MRI Inference Job Architecture Test Suite', () => {
  let server;
  let baseUrl;
  let patientA;
  let patientB;
  let tokenA;
  let tokenB;

  // 1x1 valid PNG image buffer
  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    patientA = await Patient.create({
      patientId: `pat_async_a_${Date.now()}`,
      name: 'Async Patient A',
      email: 'async_a@test.com',
      role: 'patient',
    });
    tokenA = signToken({ patientId: patientA.patientId, role: 'patient' });

    patientB = await Patient.create({
      patientId: `pat_async_b_${Date.now()}`,
      name: 'Async Patient B',
      email: 'async_b@test.com',
      role: 'patient',
    });
    tokenB = signToken({ patientId: patientB.patientId, role: 'patient' });
  });

  after(async () => {
    if (patientA) await Patient.deleteOne({ _id: patientA._id });
    if (patientB) await Patient.deleteOne({ _id: patientB._id });
    await InferenceJob.deleteMany({ patientId: { $in: [patientA?.patientId, patientB?.patientId] } });
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  test('1. POST /api/predict/async without file returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/predict/async`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing required 'image' file/i);
  });

  test('2. POST /api/predict/async with valid MRI returns HTTP 202 Accepted and jobId', async () => {
    const boundary = '----WebKitFormBoundaryAsyncTest' + Date.now();
    const parts = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="image"; filename="scan.png"\r\n',
      'Content-Type: image/png\r\n\r\n',
      samplePngBuffer,
      `\r\n--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));

    const res = await fetch(`${baseUrl}/api/predict/async?include_heatmaps=false`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${tokenA}`,
      },
      body,
    });

    assert.equal(res.status, 202);
    const data = await res.json();
    assert.equal(data.status, 'queued');
    assert.ok(data.jobId.startsWith('job_'));
    assert.equal(data.pollUrl, `/api/jobs/${data.jobId}`);

    // Verify stored job in database
    const jobInDb = await InferenceJob.findOne({ jobId: data.jobId });
    assert.ok(jobInDb);
    assert.equal(jobInDb.patientId, patientA.patientId);

    // Poll job status until complete to verify the entire asynchronous lifecycle
    let finalStatus = 'queued';
    let finalResult = null;
    for (let i = 0; i < 30; i++) {
      const pollRes = await fetch(`${baseUrl}/api/jobs/${data.jobId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const pollData = await pollRes.json();
      finalStatus = pollData.status;
      finalResult = pollData.result;
      if (finalStatus === 'completed' || finalStatus === 'failed') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.equal(finalStatus, 'completed');
    assert.ok(finalResult);
    assert.ok(finalResult.predictedClass);
    assert.ok(finalResult.historySaved);
  });


  test('3. Cross-patient job status query returns 403 Forbidden', async () => {
    // Create job owned by patient A
    const job = await InferenceJob.create({
      jobId: `job_cross_test_${Date.now()}`,
      patientId: patientA.patientId,
      status: 'queued',
    });

    // Patient B attempts to access Patient A's job
    const res = await fetch(`${baseUrl}/api/jobs/${job.jobId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /Forbidden/i);
  });

  test('4. Legitimate patient can query own job status', async () => {
    const job = await InferenceJob.create({
      jobId: `job_own_test_${Date.now()}`,
      patientId: patientA.patientId,
      status: 'processing',
      progress: 50,
    });

    const res = await fetch(`${baseUrl}/api/jobs/${job.jobId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.jobId, job.jobId);
    assert.equal(data.status, 'processing');
    assert.equal(data.progress, 50);
  });
});
