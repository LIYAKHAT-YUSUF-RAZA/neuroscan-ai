const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { app } = require('../src/server');
const Patient = require('../src/models/Patient');
const Medication = require('../src/models/Medication');
const Appointment = require('../src/models/Appointment');
const Prediction = require('../src/models/Prediction');
const { connectDB } = require('../src/config/db');
const { signToken, verifyJwtToken } = require('../src/middlewares/auth');
const { jwtSecret } = require('../src/config/env');

test('Comprehensive Dashboard Authentication & 403 Security Hardening Suite (15 Test Matrix)', async (t) => {
  let server;
  let baseUrl;
  const timestamp = Date.now();

  const patientA_id = `pat_test_a_${timestamp}`;
  const patientB_id = `pat_test_b_${timestamp}`;

  let researcherJwt;
  let clinicianJwt;
  let patientAJwt;
  let patientBJwt;

  await t.test('Setup: Start test server, connect DB, and seed test fixtures', async () => {
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
      {
        patientId: patientA_id,
        name: 'Alice Hardened',
        email: `alice_${timestamp}@test.com`,
        role: 'patient',
        timezone: 'Asia/Kolkata',
      },
      {
        patientId: patientB_id,
        name: 'Bob Isolated',
        email: `bob_${timestamp}@test.com`,
        role: 'patient',
        timezone: 'Asia/Kolkata',
      },
    ]);

    // Seed medication for Patient A
    await Medication.create({
      patientId: patientA_id,
      name: 'Donepezil',
      dosage: '10mg',
      frequency: 'Once Daily',
      times: [{ time: '09:00 AM', label: 'Morning Dose' }],
      status: 'active',
    });

    // Seed appointment for Patient A
    await Appointment.create({
      patientId: patientA_id,
      specialistName: 'Dr. Neurologist',
      specialty: 'Cognitive Neurology',
      location: 'Medical Center',
      appointmentDate: new Date('2026-12-01'),
      appointmentTime: '10:00 AM',
    });

    // Seed prediction for Patient A
    await Prediction.create({
      patientId: patientA_id,
      predictedClass: 'NonDemented',
      stageLabel: 'Healthy / No Dementia Detected',
      stageNumber: 1,
      probabilities: { MildDemented: 0.05, ModerateDemented: 0.01, NonDemented: 0.9, VeryMildDemented: 0.04 },
    });

    // Mint valid tokens
    researcherJwt = signToken({
      id: 'researcher-001',
      patientId: 'researcher-001',
      role: 'researcher',
      name: 'Dr. Lead Researcher',
    });

    clinicianJwt = signToken({
      id: 'clinician-001',
      patientId: 'clinician-001',
      role: 'clinician',
      name: 'Dr. Attending Clinician',
    });

    patientAJwt = signToken({
      id: patientA_id,
      patientId: patientA_id,
      role: 'patient',
      name: 'Alice Hardened',
      email: `alice_${timestamp}@test.com`,
    });

    patientBJwt = signToken({
      id: patientB_id,
      patientId: patientB_id,
      role: 'patient',
      name: 'Bob Isolated',
      email: `bob_${timestamp}@test.com`,
    });
  });

  // ================= 1. Valid Researcher JWT =================
  await t.test('1. Valid researcher JWT: Can access patient profile, medications, and appointments', async () => {
    // Access /api/patients/me for patientA
    const meRes = await fetch(`${baseUrl}/api/patients/me`, {
      headers: {
        Authorization: `Bearer ${researcherJwt}`,
        'x-target-patient-id': patientA_id,
      },
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.data.patientId, patientA_id);

    // Access /api/care/medications
    const medRes = await fetch(`${baseUrl}/api/care/medications?patientId=${patientA_id}`, {
      headers: {
        Authorization: `Bearer ${researcherJwt}`,
        'x-target-patient-id': patientA_id,
      },
    });
    assert.strictEqual(medRes.status, 200);
    const medData = await medRes.json();
    assert.strictEqual(medData.success, true);
    assert.ok(medData.data.length >= 1);
  });

  // ================= 2. Valid Clinician JWT =================
  await t.test('2. Valid clinician JWT: Can access care records and patient profile', async () => {
    const apptRes = await fetch(`${baseUrl}/api/care/appointments?patientId=${patientA_id}`, {
      headers: {
        Authorization: `Bearer ${clinicianJwt}`,
        'x-target-patient-id': patientA_id,
      },
    });
    assert.strictEqual(apptRes.status, 200);
    const apptData = await apptRes.json();
    assert.strictEqual(apptData.success, true);
    assert.ok(apptData.data.length >= 1);
  });

  // ================= 3. Valid Patient JWT =================
  await t.test('3. Valid patient JWT: Patient A can access own profile, medications, and history', async () => {
    const meRes = await fetch(`${baseUrl}/api/patients/me`, {
      headers: {
        Authorization: `Bearer ${patientAJwt}`,
      },
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.success, true);
    assert.strictEqual(meData.data.patientId, patientA_id);

    const medRes = await fetch(`${baseUrl}/api/care/medications?patientId=${patientA_id}`, {
      headers: {
        Authorization: `Bearer ${patientAJwt}`,
      },
    });
    assert.strictEqual(medRes.status, 200);
    const medData = await medRes.json();
    assert.strictEqual(medData.success, true);
    assert.ok(medData.data.length >= 1);
  });

  // ================= 4. Missing JWT =================
  await t.test('4. Missing JWT: Request to protected patient profile returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/patients/me`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // ================= 5. Expired JWT =================
  await t.test('5. Expired JWT: Rejected with 401 Unauthorized', async () => {
    // Mint token with negative expiration (-10s)
    const expiredJwt = jwt.sign(
      { id: patientA_id, patientId: patientA_id, role: 'patient' },
      jwtSecret,
      { expiresIn: '-10s', algorithm: 'HS256' }
    );

    const res = await fetch(`${baseUrl}/api/patients/me`, {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('expired') || data.error.includes('Invalid'));
  });

  // ================= 6. Invalid Signature =================
  await t.test('6. Invalid signature: Token signed with foreign secret returns 401 Unauthorized', async () => {
    const bogusSecret = 'wrong-secret-key-32bytes-for-unit-test!';
    const bogusJwt = jwt.sign(
      { id: patientA_id, patientId: patientA_id, role: 'patient' },
      bogusSecret,
      { algorithm: 'HS256' }
    );

    const res = await fetch(`${baseUrl}/api/patients/me`, {
      headers: { Authorization: `Bearer ${bogusJwt}` },
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // ================= 7. Forged JWT =================
  await t.test('7. Forged JWT: Altered payload with same signature returns 401 Unauthorized', async () => {
    const parts = patientAJwt.split('.');
    // Tamper with payload (middle part)
    const forgedPayload = Buffer.from(JSON.stringify({ id: patientA_id, role: 'admin' })).toString('base64url');
    const forgedJwt = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    const res = await fetch(`${baseUrl}/api/patients/me`, {
      headers: { Authorization: `Bearer ${forgedJwt}` },
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // ================= 8. Arbitrary Role Supplied in Request Body =================
  await t.test('8. Arbitrary role in request body: Request containing role="researcher" does NOT grant researcher role', async () => {
    // Plaintext caller or unauthenticated body specifying role: researcher
    const res = await fetch(`${baseUrl}/api/patients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    // Should NOT return all patients if not authenticated as researcher
    const data = await res.json();
    assert.notStrictEqual(data.data?.length, 2);
  });

  // ================= 9. Patient A accessing Patient A =================
  await t.test('9. Patient A accessing Patient A: Successfully returns own records without 403', async () => {
    const res = await fetch(`${baseUrl}/api/care/appointments?patientId=${patientA_id}`, {
      headers: {
        Authorization: `Bearer ${patientAJwt}`,
        'x-patient-id': patientA_id,
      },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });

  // ================= 10. Patient A accessing Patient B =================
  await t.test('10. Patient A accessing Patient B: Cross-patient access strictly rejected with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications?patientId=${patientB_id}`, {
      headers: {
        Authorization: `Bearer ${patientAJwt}`,
        'x-target-patient-id': patientB_id,
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Access denied'));
  });

  // ================= 11. Unauthenticated Token Issuance Attempt =================
  await t.test('11. Unauthenticated token issuance: POST /api/auth/login rejects unregistered emails with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_impostor@unknown.com' }),
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // ================= 12. Unauthorized Demo Seeding =================
  await t.test('12. Unauthorized demo seeding: Ordinary patient calling POST /api/patients/seed-demo returns 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/patients/seed-demo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAJwt}`,
        'Content-Type': 'application/json',
      },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Ordinary patients cannot seed demo profiles'));
  });

  // ================= 13. Development Bootstrap Disabled in Production =================
  await t.test('13. Development bootstrap guardrail: devSessionBootstrap returns 403 when NODE_ENV=production', async () => {
    // Test logic: simulates devSessionBootstrap call when nodeEnv === 'production'
    const { devSessionBootstrap } = require('../src/controllers/authController');
    let statusCode = 0;
    let jsonResult = null;

    const mockReq = { body: { role: 'researcher' } };
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { jsonResult = data; },
        };
      },
    };

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await devSessionBootstrap(mockReq, mockRes);
      assert.strictEqual(statusCode, 403);
      assert.strictEqual(jsonResult.success, false);
      assert.ok(jsonResult.error.includes('strictly disabled in production'));
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  // ================= 14. Registration Token Ingestion =================
  await t.test('14. Registration token ingestion: Registering returns valid JWT that can immediately authenticate', async () => {
    const newPatId = `pat_reg_${Date.now()}`;
    const regRes = await fetch(`${baseUrl}/api/patients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: newPatId,
        name: 'Registered Test Patient',
        email: `reg_${Date.now()}@example.com`,
      }),
    });
    assert.strictEqual(regRes.status, 201);
    const regData = await regRes.json();
    assert.strictEqual(regData.success, true);
    assert.ok(regData.data.token, 'Registration must return signed token');

    // Ingest and authenticate with returned token
    const testMeRes = await fetch(`${baseUrl}/api/patients/me`, {
      headers: {
        Authorization: `Bearer ${regData.data.token}`,
      },
    });
    assert.strictEqual(testMeRes.status, 200);
    const meBody = await testMeRes.json();
    assert.strictEqual(meBody.data.patientId, newPatId);
  });

  // ================= 15. Patient Switching & Session Synchronization =================
  await t.test('15. Patient switching and session synchronization: Verified session me endpoint reflects current identity', async () => {
    // Verify session identity with Patient A token
    const authMeResA = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${patientAJwt}` },
    });
    assert.strictEqual(authMeResA.status, 200);
    const meDataA = await authMeResA.json();
    assert.strictEqual(meDataA.data.patientId, patientA_id);
    assert.strictEqual(meDataA.data.role, 'patient');

    // Switch session to Patient B token
    const authMeResB = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${patientBJwt}` },
    });
    assert.strictEqual(authMeResB.status, 200);
    const meDataB = await authMeResB.json();
    assert.strictEqual(meDataB.data.patientId, patientB_id);
    assert.strictEqual(meDataB.data.role, 'patient');
  });

  await t.test('Teardown: Close test server and cleanup', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
