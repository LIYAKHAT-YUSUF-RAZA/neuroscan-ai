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

describe('Patient Switching & Scan Action Isolation Test Suite', () => {
  let server;
  let baseUrl;
  let patientA;
  let patientB;
  let patientC; // Empty patient with 0 scans
  let tokenA;
  let tokenB;
  let researcherToken;
  let scanA;
  let predA;
  let scanB;
  let predB;

  // 1x1 dummy PNG buffer
  const samplePng = Buffer.from([
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

    const ts = Date.now();
    patientA = await Patient.create({
      patientId: `pat_switch_a_${ts}`,
      name: 'Patient A (Mild)',
      email: `pata_${ts}@example.com`,
      role: 'patient',
    });
    tokenA = signToken({ id: patientA.patientId, patientId: patientA.patientId, role: 'patient' });

    patientB = await Patient.create({
      patientId: `pat_switch_b_${ts}`,
      name: 'Patient B (Moderate)',
      email: `patb_${ts}@example.com`,
      role: 'patient',
    });
    tokenB = signToken({ id: patientB.patientId, patientId: patientB.patientId, role: 'patient' });

    patientC = await Patient.create({
      patientId: `pat_switch_c_${ts}`,
      name: 'Patient C (New / No Scans)',
      email: `patc_${ts}@example.com`,
      role: 'patient',
    });

    researcherToken = signToken({
      id: 'researcher-test-lead',
      patientId: 'researcher-test-lead',
      role: 'researcher',
    });

    // Create a scan and prediction for Patient A
    scanA = await MriScan.create({
      scanId: `scan_a_${ts}`,
      patientId: patientA.patientId,
      originalFilename: 'patient_a_scan.png',
      fileSize: samplePng.length,
      fileHash: 'dummyhash_a_' + ts,
      mimeType: 'image/png',
      storageReference: `mri_scans/${patientA.patientId}/scan_a_${ts}.png`,
      scanDate: new Date('2025-01-15'),
      scanStatus: 'active',
    });

    predA = await Prediction.create({
      patientId: patientA.patientId,
      scanId: scanA.scanId,
      originalFilename: scanA.originalFilename,
      fileSize: scanA.fileSize,
      predictedClass: 'MildDemented',
      stageLabel: 'Mild Cognitive Decline',
      stageNumber: 3,
      probabilities: { MildDemented: 0.85, ModerateDemented: 0.05, NonDemented: 0.05, VeryMildDemented: 0.05 },
      scanDate: scanA.scanDate,
      evaluationType: 'original',
    });
    scanA.latestPredictionId = predA._id;
    await scanA.save();

    // Create a scan and prediction for Patient B
    scanB = await MriScan.create({
      scanId: `scan_b_${ts}`,
      patientId: patientB.patientId,
      originalFilename: 'patient_b_scan.png',
      fileSize: samplePng.length,
      fileHash: 'dummyhash_b_' + ts,
      mimeType: 'image/png',
      storageReference: `mri_scans/${patientB.patientId}/scan_b_${ts}.png`,
      scanDate: new Date('2025-03-20'),
      scanStatus: 'active',
    });

    predB = await Prediction.create({
      patientId: patientB.patientId,
      scanId: scanB.scanId,
      originalFilename: scanB.originalFilename,
      fileSize: scanB.fileSize,
      predictedClass: 'ModerateDemented',
      stageLabel: 'Moderate Cognitive Decline',
      stageNumber: 4,
      probabilities: { MildDemented: 0.05, ModerateDemented: 0.90, NonDemented: 0.02, VeryMildDemented: 0.03 },
      scanDate: scanB.scanDate,
      evaluationType: 'original',
    });
    scanB.latestPredictionId = predB._id;
    await scanB.save();
  });

  after(async () => {
    if (patientA) await Patient.deleteOne({ patientId: patientA.patientId });
    if (patientB) await Patient.deleteOne({ patientId: patientB.patientId });
    if (patientC) await Patient.deleteOne({ patientId: patientC.patientId });
    if (scanA) await MriScan.deleteMany({ patientId: patientA.patientId });
    if (scanB) await MriScan.deleteMany({ patientId: patientB.patientId });
    if (predA) await Prediction.deleteMany({ patientId: patientA.patientId });
    if (predB) await Prediction.deleteMany({ patientId: patientB.patientId });
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('1. Patient A -> Patient B Switching: Correct data isolation and zero cross-patient leakage', async () => {
    // 1a. Researcher views Patient A
    const resA = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientA.patientId,
      },
    });
    assert.strictEqual(resA.status, 200);
    const dataA = await resA.json();
    assert.strictEqual(dataA.success, true);
    assert.strictEqual(dataA.count, 1);
    assert.strictEqual(dataA.scans[0].patientId, patientA.patientId);
    assert.strictEqual(dataA.scans[0].scanId, scanA.scanId);

    // 1b. Researcher switches to Patient B
    const resB = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientB.patientId,
      },
    });
    assert.strictEqual(resB.status, 200);
    const dataB = await resB.json();
    assert.strictEqual(dataB.success, true);
    assert.strictEqual(dataB.count, 1);
    assert.strictEqual(dataB.scans[0].patientId, patientB.patientId);
    assert.strictEqual(dataB.scans[0].scanId, scanB.scanId);

    // Ensure zero cross-patient data in history
    const histA = await fetch(`${baseUrl}/api/history`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientA.patientId,
      },
    });
    const histAData = await histA.json();
    assert.strictEqual(histAData.data.every((r) => r.patientId === patientA.patientId), true);

    const histB = await fetch(`${baseUrl}/api/history`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientB.patientId,
      },
    });
    const histBData = await histB.json();
    assert.strictEqual(histBData.data.every((r) => r.patientId === patientB.patientId), true);
  });

  test('2. Multi-Switch: Patient A -> Patient B -> Patient C (Empty Patient) -> Patient A', async () => {
    // Switch to Patient C (who has no scans)
    const resC = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientC.patientId,
      },
    });
    assert.strictEqual(resC.status, 200);
    const dataC = await resC.json();
    assert.strictEqual(dataC.success, true);
    assert.strictEqual(dataC.count, 0);
    assert.deepStrictEqual(dataC.scans, []);

    // History for Patient C is empty
    const histC = await fetch(`${baseUrl}/api/history`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientC.patientId,
      },
    });
    const histCData = await histC.json();
    assert.strictEqual(histCData.count, 0);

    // Switch back to Patient A
    const resBackA = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientA.patientId,
      },
    });
    const dataBackA = await resBackA.json();
    assert.strictEqual(dataBackA.count, 1);
    assert.strictEqual(dataBackA.scans[0].scanId, scanA.scanId);
  });

  test('3. View Current Results: Resolves actual prediction record for active patient', async () => {
    // Fetch latest prediction for Patient B via history?limit=1
    const res = await fetch(`${baseUrl}/api/history?limit=1`, {
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientB.patientId,
      },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.length, 1);
    const latest = json.data[0];
    assert.strictEqual(latest.patientId, patientB.patientId);
    assert.strictEqual(latest.predictedClass, 'ModerateDemented');
    assert.strictEqual(latest.stageNumber, 4);
    assert.ok(latest.probabilities);
    assert.strictEqual(latest.probabilities.ModerateDemented, 0.90);

    // Ordinary patient cannot forge access to another patient's evaluation
    const forgeRes = await fetch(`${baseUrl}/api/history`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'x-target-patient-id': patientB.patientId,
      },
    });
    assert.strictEqual(forgeRes.status, 403);
  });

  test('4. Reanalyse This Scan: Ownership verification & resolution from prediction ID', async () => {
    // 4a. Researcher targeting Patient B cannot reanalyse Patient A scan
    const forbiddenRes = await fetch(`${baseUrl}/api/scans/${scanA.scanId}/reanalyse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientB.patientId,
      },
    });
    assert.strictEqual(forbiddenRes.status, 403);

    // 4b. Patient A cannot reanalyse Patient B scan
    const patForbidden = await fetch(`${baseUrl}/api/scans/${scanB.scanId}/reanalyse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    assert.strictEqual(patForbidden.status, 403);

    // 4c. Reanalysing a non-existent scan returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/scans/non_existent_scan_xyz/reanalyse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${researcherToken}`,
        'x-target-patient-id': patientA.patientId,
      },
    });
    assert.strictEqual(notFoundRes.status, 404);
  });

  test('5. Upload Follow-up MRI & Reject Cross-Patient Comparison', async () => {
    // Attempt to compare Patient A's evaluation with Patient B's evaluation
    const compRes = await fetch(
      `${baseUrl}/api/history/compare?eval1=${predA._id.toString()}&eval2=${predB._id.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${researcherToken}`,
          'x-target-patient-id': patientA.patientId,
        },
      }
    );

    // Must be rejected (403 Forbidden because eval2 does not belong to target patient A)
    assert.strictEqual(compRes.status, 403);
    const compData = await compRes.json();
    assert.strictEqual(compData.success, false);

    // Even without x-target-patient-id, cross-patient comparison is rejected with 400
    const rawCrossRes = await fetch(
      `${baseUrl}/api/history/compare?eval1=${predA._id.toString()}&eval2=${predB._id.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${researcherToken}`,
        },
      }
    );
    assert.strictEqual(rawCrossRes.status, 400);
    const rawCrossData = await rawCrossRes.json();
    assert.strictEqual(rawCrossData.success, false);
    assert.ok(rawCrossData.error.includes('Cross-patient comparison is invalid'));
  });

  test('6. Ordinary Patient Identity Isolation: Cannot spoof patient context', async () => {
    // Patient A attempting to access Patient B scans
    const res = await fetch(`${baseUrl}/api/scans/${scanB.scanId}`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    assert.strictEqual(res.status, 403);

    // Patient B attempting to access Patient A scan image stream
    const imgRes = await fetch(`${baseUrl}/api/scans/${scanA.scanId}/image`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.strictEqual(imgRes.status, 403);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });
});

