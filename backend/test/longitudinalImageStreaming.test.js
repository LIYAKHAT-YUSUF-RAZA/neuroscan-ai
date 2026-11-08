const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const MriScan = require('../src/models/MriScan');
const Prediction = require('../src/models/Prediction');
const { signToken } = require('../src/middlewares/auth');

describe('Longitudinal MRI Image Streaming & Security Test Suite', () => {
  let server;
  let baseUrl;
  let patientA;
  let patientB;
  let tokenA;
  let tokenB;
  let baselineScanA;
  let baselinePredA;
  let followupScanA;
  let followupPredA;
  let reanalysisPredA;

  // Valid 1x1 PNG image buffer
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

    const timestamp = Date.now();
    patientA = await Patient.create({
      patientId: `pat_long_a_${timestamp}`,
      name: 'Alice Long Patient',
      email: `alice_${timestamp}@test.com`,
      role: 'patient',
    });
    tokenA = signToken({ patientId: patientA.patientId, role: 'patient' });

    patientB = await Patient.create({
      patientId: `pat_long_b_${timestamp}`,
      name: 'Bob Long Patient',
      email: `bob_${timestamp}@test.com`,
      role: 'patient',
    });
    tokenB = signToken({ patientId: patientB.patientId, role: 'patient' });

    // 1. Upload baseline MRI for Patient A
    const form1 = new FormData();
    form1.append('image', new Blob([samplePngBuffer], { type: 'image/png' }), 'baseline_scan.png');
    form1.append('evaluationType', 'original');
    const res1 = await fetch(`${baseUrl}/api/predict?include_heatmaps=false`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: form1,
    });
    const data1 = await res1.json();
    baselineScanA = await MriScan.findOne({ scanId: data1.scanId });
    baselinePredA = await Prediction.findOne({ scanId: data1.scanId });

    // 2. Upload follow-up MRI for Patient A
    const form2 = new FormData();
    form2.append('image', new Blob([samplePngBuffer], { type: 'image/png' }), 'followup_scan.png');
    form2.append('evaluationType', 'follow_up');
    form2.append('visitDate', '2026-11-05');
    const res2 = await fetch(`${baseUrl}/api/predict?include_heatmaps=false`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: form2,
    });
    const data2 = await res2.json();
    followupScanA = await MriScan.findOne({ scanId: data2.scanId });
    followupPredA = await Prediction.findOne({ scanId: data2.scanId });

    // 3. Reanalyse baseline MRI for Patient A
    const res3 = await fetch(`${baseUrl}/api/scans/${baselineScanA.scanId}/reanalyse?include_heatmaps=false`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const data3 = await res3.json();
    reanalysisPredA = await Prediction.findById(data3.historyId);
  });

  after(async () => {
    if (patientA) {
      await Patient.deleteOne({ _id: patientA._id });
      await MriScan.deleteMany({ patientId: patientA.patientId });
      await Prediction.deleteMany({ patientId: patientA.patientId });
    }
    if (patientB) {
      await Patient.deleteOne({ _id: patientB._id });
      await MriScan.deleteMany({ patientId: patientB.patientId });
      await Prediction.deleteMany({ patientId: patientB.patientId });
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  test('1. Patient A can view Patient A baseline MRI scan binary', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${baselineScanA.scanId}/image`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(buffer.length, samplePngBuffer.length);
  });

  test('2. Patient A can view Patient A follow-up MRI scan binary', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${followupScanA.scanId}/image`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(buffer.length, samplePngBuffer.length);
  });

  test('3. Patient B cannot view Patient A baseline MRI scan (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${baselineScanA.scanId}/image`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /access denied/i);
  });

  test('4. Patient B cannot view Patient A follow-up MRI scan (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${followupScanA.scanId}/image`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /access denied/i);
  });

  test('5. Reanalysis evaluation resolves to original physical MRI scanId', async () => {
    assert.ok(reanalysisPredA);
    assert.strictEqual(reanalysisPredA.scanId, baselineScanA.scanId);
    assert.strictEqual(reanalysisPredA.evaluationType, 'reanalysis');
    assert.strictEqual(reanalysisPredA.previousEvaluationId.toString(), baselinePredA._id.toString());

    // Fetching the image via the reanalysis scanId returns baseline image
    const res = await fetch(`${baseUrl}/api/scans/${reanalysisPredA.scanId}/image`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(buffer.length, samplePngBuffer.length);
  });

  test('6. Longitudinal history endpoint returns resolved scanIds for all evaluations', async () => {
    const res = await fetch(`${baseUrl}/api/history/longitudinal`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.evaluations.length, 3);

    // Each evaluation must have a valid scanId pointing to baseline or follow-up
    const scanIds = data.evaluations.map((e) => e.scanId);
    assert.ok(scanIds.includes(baselineScanA.scanId));
    assert.ok(scanIds.includes(followupScanA.scanId));
  });

  test('7. Missing MRI scan produces a graceful 404 response without internal leakage', async () => {
    const res = await fetch(`${baseUrl}/api/scans/non_existent_scan_id_9999/image`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /not found/i);
  });

  test('8. Unauthenticated image request is rejected with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${baselineScanA.scanId}/image`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /authentication required/i);
  });
});
