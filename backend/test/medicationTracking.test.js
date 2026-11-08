const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

test('Medication Tracking & Dose Administration Tests', async (t) => {
  let server;
  let baseUrl;
  const testPatient = `patient-unit-${Date.now()}`;
  const otherPatient = `patient-other-${Date.now()}`;

  await t.test('Start test server on ephemeral port', async () => {
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

  let createdMedId;

  await t.test('1. Create medication schedule with past and future times', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-patient-id': testPatient,
      },
      body: JSON.stringify({
        name: 'Donepezil',
        dosage: '10 mg',
        frequency: 'Twice Daily',
        instructions: 'Take after breakfast and dinner with full glass of water',
        prescribedBy: 'Dr. Neurologist',
        scheduledTimes: [
          { time: '08:00 AM', label: 'Morning' },
          { time: '11:59 PM', label: 'Night' },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.name, 'Donepezil');
    assert.strictEqual(data.data.dosage, '10 mg');
    assert.strictEqual(data.data.scheduledTimes.length, 2);
    createdMedId = data.data._id;
  });

  let todayDoses = [];

  await t.test('2. Retrieve today doses, verify idempotency and 60-min grace period evaluation', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': testPatient },
    });
    assert.strictEqual(res.status, 200);
    const resData = await res.json();
    assert.ok(resData.success);
    const payload = resData.data || resData;
    assert.ok(Array.isArray(payload.doses));
    assert.strictEqual(payload.doses.length, 2);
    todayDoses = payload.doses;
    assert.strictEqual(payload.summary.total, 2);
    assert.strictEqual(payload.summary.taken, 0);
    assert.strictEqual(payload.summary.skipped, 0);
    assert.strictEqual(payload.summary.upcoming + payload.summary.missed, 2);

    // Second call should return the exact same 2 records without duplicates (idempotency)
    const res2 = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': testPatient },
    });
    const resData2 = await res2.json();
    const payload2 = resData2.data || resData2;
    assert.strictEqual(payload2.doses.length, 2);
  });

  await t.test('3. Independent dose tracking: Mark morning dose as taken', async () => {
    const morningDose = todayDoses.find((d) => d.scheduledTime === '08:00 AM' || d.label === 'Morning') || todayDoses[0];
    assert.ok(morningDose, 'Morning dose must exist');

    const patchRes = await fetch(`${baseUrl}/api/care/medications/doses/${morningDose.doseId || morningDose._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-patient-id': testPatient,
      },
      body: JSON.stringify({
        status: 'taken',
        notes: 'Taken with breakfast',
      }),
    });

    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.ok(patchData.success);
    assert.strictEqual(patchData.data.status, 'taken');
    assert.ok(patchData.data.takenAt);

    // Verify today's doses summary
    const todayRes = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': testPatient },
    });
    const todayData = await todayRes.json();
    const payload = todayData.data || todayData;

    assert.strictEqual(payload.summary.taken, 1);
    assert.strictEqual(payload.summary.missed, 0);
    assert.strictEqual(payload.summary.upcoming, 1);

    // Evening dose MUST still be pending and unadministered!
    const eveningDose = payload.doses.find((d) => d.scheduledTime === '11:59 PM' || d.label === 'Night');
    assert.ok(eveningDose, 'Evening dose must exist');
    assert.strictEqual(eveningDose.status, 'pending');
    assert.strictEqual(eveningDose.takenAt, null);
  });

  await t.test('4. Prevent double-marking as taken', async () => {
    const morningDose = todayDoses.find((d) => d.scheduledTime === '08:00 AM' || d.label === 'Morning');
    const patchRes = await fetch(`${baseUrl}/api/care/medications/doses/${morningDose.doseId || morningDose._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-patient-id': testPatient,
      },
      body: JSON.stringify({
        status: 'taken',
      }),
    });

    assert.strictEqual(patchRes.status, 400);
    const errData = await patchRes.json();
    assert.match(errData.error, /already been recorded as taken/i);
  });

  await t.test('5. Skip dose tracking: Skipped dose is NOT counted as taken', async () => {
    // Re-fetch today's doses to get current state
    const todayRes = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': testPatient },
    });
    const todayData = await todayRes.json();
    const payload = todayData.data || todayData;
    const eveningDose = payload.doses.find((d) => d.scheduledTime === '11:59 PM' || d.label === 'Night');

    const patchRes = await fetch(`${baseUrl}/api/care/medications/doses/${eveningDose.doseId || eveningDose._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-patient-id': testPatient,
      },
      body: JSON.stringify({
        status: 'skipped',
        notes: 'Caregiver advised skipping due to temporary stomach upset',
      }),
    });

    assert.strictEqual(patchRes.status, 200);

    // Verify summary reflects 1 taken, 0 upcoming, 0 missed, 1 skipped
    const summaryRes = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': testPatient },
    });
    const summaryData = await summaryRes.json();
    const sPayload = summaryData.data || summaryData;

    assert.strictEqual(sPayload.summary.taken, 1);
    assert.strictEqual(sPayload.summary.skipped, 1);
    assert.strictEqual(sPayload.summary.upcoming, 0);
  });

  await t.test('6. Edit medication schedule updates details and syncs', async () => {
    const editRes = await fetch(`${baseUrl}/api/care/medications/${createdMedId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-patient-id': testPatient,
      },
      body: JSON.stringify({
        name: 'Donepezil Hydrochloride',
        dosage: '10 mg film-coated',
        frequency: 'Twice Daily',
        instructions: 'Take with food and full glass of water',
        scheduledTimes: [
          { time: '08:30 AM', label: 'Morning' },
          { time: '11:45 PM', label: 'Night' },
        ],
      }),
    });

    assert.strictEqual(editRes.status, 200);
    const editData = await editRes.json();
    assert.ok(editData.success);
    assert.strictEqual(editData.data.name, 'Donepezil Hydrochloride');
    assert.strictEqual(editData.data.dosage, '10 mg film-coated');
  });

  await t.test('7. Discontinue medication preserves historical records', async () => {
    const delRes = await fetch(`${baseUrl}/api/care/medications/${createdMedId}`, {
      method: 'DELETE',
      headers: { 'x-patient-id': testPatient },
    });

    assert.strictEqual(delRes.status, 200);

    // Historical records must still exist in history endpoint
    const historyRes = await fetch(`${baseUrl}/api/care/medications/history`, {
      headers: { 'x-patient-id': testPatient },
    });
    assert.strictEqual(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.ok(historyData.success);
    assert.ok(historyData.data.length >= 1, 'Historical doses must be preserved');
  });

  await t.test('8. Strict Patient Scoping: Other patients cannot see or access data', async () => {
    const otherRes = await fetch(`${baseUrl}/api/care/medications/today`, {
      headers: { 'x-patient-id': otherPatient },
    });
    assert.strictEqual(otherRes.status, 200);
    const otherData = await otherRes.json();
    const payload = otherData.data || otherData;
    assert.strictEqual(payload.doses.length, 0);
    assert.strictEqual(payload.summary.total, 0);
  });

  await t.test('Close test server', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
