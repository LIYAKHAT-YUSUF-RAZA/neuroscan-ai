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

describe('MRI Rescan, Storage, and Longitudinal Research Tracking Test Suite', () => {
  let server;
  let baseUrl;
  let patientA;
  let patientB;
  let tokenA;
  let tokenB;
  let scanA1;
  let evalA1;
  let scanA2;
  let evalA2;

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
      patientId: `pat_mri_a_${timestamp}`,
      name: 'Alice MRI Patient',
      email: `alice_${timestamp}@test.com`,
      role: 'patient',
    });
    tokenA = signToken({ patientId: patientA.patientId, role: 'patient' });

    patientB = await Patient.create({
      patientId: `pat_mri_b_${timestamp}`,
      name: 'Bob MRI Patient',
      email: `bob_${timestamp}@test.com`,
      role: 'patient',
    });
    tokenB = signToken({ patientId: patientB.patientId, role: 'patient' });
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

  test('1. Initial MRI upload creates persistent MriScan and linked Prediction (original)', async () => {
    const formData = new FormData();
    const blob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('image', blob, 'baseline_brain_mri.png');
    formData.append('evaluationType', 'original');

    const res = await fetch(`${baseUrl}/api/predict?include_heatmaps=false`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.scanId, 'Expected response to contain scanId');
    assert.strictEqual(data.evaluationType, 'original');

    // Verify MriScan in MongoDB
    const scanDoc = await MriScan.findOne({ scanId: data.scanId });
    assert.ok(scanDoc, 'MriScan document must be created in MongoDB');
    assert.strictEqual(scanDoc.patientId, patientA.patientId);
    assert.strictEqual(scanDoc.originalFilename, 'baseline_brain_mri.png');
    assert.strictEqual(scanDoc.analysisCount, 1);
    assert.ok(scanDoc.fileHash);

    // Verify Prediction in MongoDB
    const predDoc = await Prediction.findOne({ scanId: data.scanId });
    assert.ok(predDoc, 'Prediction document must exist');
    assert.strictEqual(predDoc.evaluationType, 'original');
    assert.strictEqual(predDoc.patientId, patientA.patientId);

    scanA1 = scanDoc;
    evalA1 = predDoc;
  });

  test('2. Authenticated GET /api/scans/:scanId/image streams valid image binary', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${scanA1.scanId}/image`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    const arrayBuffer = await res.arrayBuffer();
    const returnedBuffer = Buffer.from(arrayBuffer);
    assert.strictEqual(returnedBuffer.length, samplePngBuffer.length);
    assert.deepStrictEqual(returnedBuffer, samplePngBuffer);
  });

  test('3. Reanalyse scan POST /api/scans/:scanId/reanalyse reuses stored image without reupload', async () => {
    const res = await fetch(`${baseUrl}/api/scans/${scanA1.scanId}/reanalyse?include_heatmaps=false`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.scanId, scanA1.scanId);
    assert.strictEqual(data.evaluationType, 'reanalysis');
    assert.strictEqual(data.previousEvaluationId, evalA1._id.toString());

    // Verify updated MriScan analysisCount
    const updatedScan = await MriScan.findOne({ scanId: scanA1.scanId });
    assert.strictEqual(updatedScan.analysisCount, 2);

    // Verify original prediction is preserved and new reanalysis prediction is added
    const totalPredictions = await Prediction.countDocuments({ scanId: scanA1.scanId });
    assert.strictEqual(totalPredictions, 2);
  });

  test('4. Upload follow-up MRI creates distinct MriScan and new Prediction (follow_up)', async () => {
    const formData = new FormData();
    const blob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('image', blob, 'followup_visit2_mri.png');
    formData.append('evaluationType', 'follow_up');
    formData.append('visitDate', '2026-11-04');
    formData.append('visitNotes', '6-month follow-up visit');

    const res = await fetch(`${baseUrl}/api/predict?include_heatmaps=false`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      body: formData,
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.scanId);
    assert.notStrictEqual(data.scanId, scanA1.scanId, 'Follow-up must create distinct scan entity');
    assert.strictEqual(data.evaluationType, 'follow_up');

    const scanDoc2 = await MriScan.findOne({ scanId: data.scanId });
    assert.ok(scanDoc2);
    assert.strictEqual(scanDoc2.originalFilename, 'followup_visit2_mri.png');
    assert.strictEqual(scanDoc2.visitNotes, '6-month follow-up visit');

    const predDoc2 = await Prediction.findOne({ scanId: data.scanId });
    assert.ok(predDoc2);
    assert.strictEqual(predDoc2.evaluationType, 'follow_up');

    scanA2 = scanDoc2;
    evalA2 = predDoc2;
  });

  test('5. Cross-patient security: Patient B cannot access, stream, or reanalyse Patient A scan (403 Forbidden)', async () => {
    // 5.1 Patient B attempts to get details of Patient A's scan
    const resDetails = await fetch(`${baseUrl}/api/scans/${scanA1.scanId}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.strictEqual(resDetails.status, 403);
    const bodyDetails = await resDetails.json();
    assert.strictEqual(bodyDetails.success, false);

    // 5.2 Patient B attempts to stream Patient A's image binary
    const resImage = await fetch(`${baseUrl}/api/scans/${scanA1.scanId}/image`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.strictEqual(resImage.status, 403);

    // 5.3 Patient B attempts to reanalyse Patient A's scan
    const resReanalyse = await fetch(`${baseUrl}/api/scans/${scanA1.scanId}/reanalyse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.strictEqual(resReanalyse.status, 403);
    const bodyReanalyse = await resReanalyse.json();
    assert.strictEqual(bodyReanalyse.success, false);
  });

  test('6. Longitudinal history GET /api/history/longitudinal excludes Out-of-Distribution (OOD) records', async () => {
    // Insert an OOD prediction for Patient A
    await Prediction.create({
      patientId: patientA.patientId,
      predictedClass: 'Out-of-Distribution',
      stageLabel: 'Out-of-Distribution',
      stageNumber: 0,
      isOod: true,
      probabilities: { MildDemented: 0.25, ModerateDemented: 0.25, NonDemented: 0.25, VeryMildDemented: 0.25 },
      originalFilename: 'random_noise_test.png',
      fileSize: 1024,
    });

    const res = await fetch(`${baseUrl}/api/history/longitudinal`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.evaluations));

    // Confirm no OOD record is included in longitudinal research series
    for (const ev of data.evaluations) {
      assert.notStrictEqual(ev.predictedClass, 'Out-of-Distribution');
      assert.notStrictEqual(ev.isOod, true);
    }
  });

  test('7. Comparison endpoint GET /api/history/compare returns paired analysis and scientific notice', async () => {
    const res = await fetch(
      `${baseUrl}/api/history/compare?eval1=${evalA1._id.toString()}&eval2=${evalA2._id.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      }
    );

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.comparison);
    assert.ok(data.comparison.evaluationA);
    assert.ok(data.comparison.evaluationB);
    assert.ok(data.comparison.probabilityDeltas);
    assert.ok(data.comparison.scientificDisclaimer);
    assert.match(
      data.comparison.scientificDisclaimer,
      /not clinically validated measurements of disease progression/i
    );
  });

  test('8. Cross-patient comparison rejection: comparing evaluation from Patient A with Patient B returns 403', async () => {
    // Create an evaluation for Patient B
    const predB = await Prediction.create({
      patientId: patientB.patientId,
      predictedClass: 'NonDemented',
      stageLabel: 'Healthy / No Dementia Detected',
      stageNumber: 1,
      probabilities: { MildDemented: 0.05, ModerateDemented: 0.05, NonDemented: 0.85, VeryMildDemented: 0.05 },
      originalFilename: 'b_mri.png',
      fileSize: 1024,
    });

    // Patient A attempts to compare their evalA1 with Patient B's predB
    const res = await fetch(
      `${baseUrl}/api/history/compare?eval1=${evalA1._id.toString()}&eval2=${predB._id.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      }
    );

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('9. Patient data isolation: GET /api/scans lists only the authenticated patient scans', async () => {
    const resA = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.strictEqual(resA.status, 200);
    const dataA = await resA.json();
    assert.strictEqual(dataA.success, true);
    assert.strictEqual(dataA.count, 2); // scanA1 and scanA2

    const resB = await fetch(`${baseUrl}/api/scans`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    assert.strictEqual(resB.status, 200);
    const dataB = await resB.json();
    assert.strictEqual(dataB.success, true);
    assert.strictEqual(dataB.count, 0); // Bob has no scans
  });
});
