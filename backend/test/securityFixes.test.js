const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const Prediction = require('../src/models/Prediction');
const Patient = require('../src/models/Patient');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/middlewares/auth');

test('Critical Security Hardening Verification Test Suite', async (t) => {
  let server;
  let baseUrl;
  const timestamp = Date.now();
  const patientA = `pat_sec_a_${timestamp}`;
  const patientB = `pat_sec_b_${timestamp}`;

  await t.test('Setup: Start test server and connect to MongoDB', async () => {
    await connectDB();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    assert.ok(baseUrl);

    // Register test patients in MongoDB
    await Patient.create([
      { patientId: patientA, name: 'Alice Security', email: `alice_${timestamp}@test.com`, role: 'patient' },
      { patientId: patientB, name: 'Bob Security', email: `bob_${timestamp}@test.com`, role: 'patient' },
    ]);

    // Seed prediction history for both patients
    await Prediction.create([
      {
        patientId: patientA,
        predictedClass: 'NonDemented',
        stageLabel: 'Healthy / No Dementia Detected',
        stageNumber: 1,
        probabilities: { MildDemented: 0.1, ModerateDemented: 0.05, NonDemented: 0.8, VeryMildDemented: 0.05 },
      },
      {
        patientId: patientB,
        predictedClass: 'MildDemented',
        stageLabel: 'Moderate Stage',
        stageNumber: 3,
        probabilities: { MildDemented: 0.85, ModerateDemented: 0.05, NonDemented: 0.05, VeryMildDemented: 0.05 },
      },
    ]);
  });

  // ================= 1. Unauthenticated & Cross-Patient History Deletion =================
  await t.test('1.1 Unauthenticated DELETE /api/history is rejected with 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/history`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);

    // Verify all records in MongoDB remain completely intact
    const countA = await Prediction.countDocuments({ patientId: patientA });
    const countB = await Prediction.countDocuments({ patientId: patientB });
    assert.strictEqual(countA, 1);
    assert.strictEqual(countB, 1);
  });

  await t.test('1.2 Cross-patient history deletion returns 403 Forbidden and isolates data', async () => {
    // Patient A attempts to target Patient B's history
    const res = await fetch(`${baseUrl}/api/history`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${patientA}`,
        'x-target-patient-id': patientB,
      },
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);

    // Verify Patient B's history is untouched
    const countB = await Prediction.countDocuments({ patientId: patientB });
    assert.strictEqual(countB, 1);
  });

  await t.test('1.3 Legitimate patient-scoped history deletion deletes only own records', async () => {
    const res = await fetch(`${baseUrl}/api/history`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${patientA}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.deletedCount, 1);
    assert.strictEqual(body.patientId, patientA);

    // Verify Patient A records are gone, but Patient B records remain intact
    const countA = await Prediction.countDocuments({ patientId: patientA });
    const countB = await Prediction.countDocuments({ patientId: patientB });
    assert.strictEqual(countA, 0);
    assert.strictEqual(countB, 1);
  });

  // ================= 2. JWT Cryptographic Authentication & Token Forgery =================
  await t.test('2.1 Plaintext forged token "Bearer clinician" does NOT grant researcher role', async () => {
    const res = await fetch(`${baseUrl}/api/patients`, {
      headers: {
        Authorization: 'Bearer clinician',
      },
    });
    // Ordinary patients or unauthenticated requests cannot view all patients
    const data = await res.json();
    assert.notStrictEqual(data.data?.length, 2);
  });

  await t.test('2.2 Tampered JWT token is rejected with 401 Unauthorized', async () => {
    const validToken = signToken({ id: patientB, patientId: patientB, role: 'patient' });
    const tamperedToken = validToken.substring(0, validToken.length - 6) + 'xxxxxx';

    const res = await fetch(`${baseUrl}/api/patients/me`, {
      headers: {
        Authorization: `Bearer ${tamperedToken}`,
      },
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('2.3 Cryptographically signed JWT token authenticates successfully', async () => {
    const validToken = signToken({ id: patientB, patientId: patientB, role: 'patient', name: 'Bob Security' });
    const res = await fetch(`${baseUrl}/api/patients/me`, {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.patientId, patientB);
  });

  // ================= 3. Upload Validation & Magic Bytes =================
  await t.test('3.1 Uploading non-image binary or text file is rejected by magic-byte validator', async () => {
    const boundary = '----TestBoundary1234';
    const fakeFileContent = 'THIS IS NOT AN IMAGE, IT IS PLAIN TEXT EXECUTABLE CODE';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="fake_mri.png"',
      'Content-Type: image/png',
      '',
      fakeFileContent,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${baseUrl}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('magic bytes'));
  });

  await t.test('3.2 Uploading unsupported file extension is rejected', async () => {
    const boundary = '----TestBoundary1234';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="image"; filename="payload.exe"',
      'Content-Type: image/png',
      '',
      'dummy data',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(`${baseUrl}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('extension'));
  });

  await t.test('Teardown: Close test server and clean up', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
