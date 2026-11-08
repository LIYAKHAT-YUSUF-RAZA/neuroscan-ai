const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');

test('Patient Care API Unit Tests', async (t) => {
  let server;
  let baseUrl;

  await t.test('Start test server', async () => {
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
  let firstDoseId;

  await t.test('POST /api/care/medications - validate required fields', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'missing name and dosage' }),
    });
    assert.strictEqual(res.status, 400);
  });

  await t.test('POST /api/care/medications - create multi-dose medication', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-patient-id': 'test-patient-001' },
      body: JSON.stringify({
        name: 'Donepezil',
        dosage: '5 mg',
        frequency: 'Twice Daily',
        instructions: 'Take after breakfast and dinner',
        prescribedBy: 'Dr. Neurologist',
        doses: [
          { time: '08:00 AM', label: 'Morning' },
          { time: '08:00 PM', label: 'Evening' },
        ],
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.name, 'Donepezil');
    assert.strictEqual(data.data.doses.length, 2);
    createdMedId = data.data._id;
    firstDoseId = data.data.doses[0].doseId;
  });

  await t.test('PATCH /api/care/medications/:id/dose - update dose status to taken', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications/${createdMedId}/dose`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doseId: firstDoseId,
        status: 'taken',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    const updatedDose = data.data.doses.find((d) => d.doseId === firstDoseId);
    assert.strictEqual(updatedDose.status, 'taken');
    assert.ok(updatedDose.takenAt);
  });

  await t.test('GET /api/care/medications - retrieve patient medications', async () => {
    const res = await fetch(`${baseUrl}/api/care/medications?patientId=test-patient-001`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.data.length >= 1);
  });

  let createdApptId;

  await t.test('POST /api/care/appointments - create specialist appointment with prep checklist', async () => {
    const res = await fetch(`${baseUrl}/api/care/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-patient-id': 'test-patient-001' },
      body: JSON.stringify({
        specialistName: 'Dr. V. Rao',
        specialty: 'Neurologist',
        facilityName: 'NIMHANS Memory Clinic',
        location: 'Bangalore, Karnataka',
        appointmentDate: '2026-11-15',
        appointmentTime: '10:30 AM',
        reasonForVisit: 'Baseline clinical assessment and MRI review',
        questionsToDiscuss: ['How do MRI findings correlate with cognitive symptoms?'],
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.specialistName, 'Dr. V. Rao');
    assert.ok(data.data.prepChecklist.length >= 4);
    createdApptId = data.data._id;
  });

  await t.test('PATCH /api/care/appointments/:id/checklist - toggle prep item', async () => {
    const res = await fetch(`${baseUrl}/api/care/appointments/${createdApptId}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex: 1 }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.prepChecklist[1].completed, true);
  });

  await t.test('Close test server', async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
