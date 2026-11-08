const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const Patient = require('../src/models/Patient');
const NotificationPreference = require('../src/models/NotificationPreference');
const NotificationDelivery = require('../src/models/NotificationDelivery');
const Prediction = require('../src/models/Prediction');
const MedicationDose = require('../src/models/MedicationDose');
const { schedulerSecretKey, nodeEnv } = require('../src/config/env');
const {
  processScheduledNotifications,
  getPatientCurrentDateTime,
  normalizeTimeStr,
} = require('../src/services/notificationScheduler');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/middlewares/auth');

test('Multi-Patient Architecture, RBAC & Email Notification Scheduler Test Suite', async (t) => {
  let server;
  let baseUrl;
  const timestamp = Date.now();

  const patientA_id = `pat-stage1-${timestamp}`;
  const patientB_id = `pat-stage2-${timestamp}`;
  const patientC_id = `pat-stage3-${timestamp}`;
  const patientD_id = `pat-stage4-${timestamp}`;
  const researcher_id = `researcher-lead-${timestamp}`;
  const researcher_jwt = signToken({
    id: researcher_id,
    patientId: researcher_id,
    role: 'researcher',
    name: 'Dr. Clinical Lead',
  });

  await t.test('Setup: Start test server and connect to MongoDB', async () => {
    await connectDB();
    await Patient.deleteMany({ email: /@test\.com$/ });
    await NotificationPreference.deleteMany({ patientEmail: /@test\.com$/ });
    await NotificationDelivery.deleteMany({ recipientEmail: /@test\.com$/ });
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
    assert.ok(baseUrl);
  });

  // ================= 1. Patient Registration & Profile Isolation =================
  await t.test('1. Patient Registration: Creates independent profile with unconsented preference defaults', async () => {
    const regRes = await fetch(`${baseUrl}/api/patients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patientA_id,
        name: 'Patient A',
        email: 'patienta@test.com',
        timezone: 'Asia/Kolkata',
      }),
    });
    assert.strictEqual(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.success);
    assert.strictEqual(regData.data.patient.patientId, patientA_id);
    assert.strictEqual(regData.data.patient.email, 'patienta@test.com');
    assert.strictEqual(regData.data.patient.role, 'patient');

    // Duplicate email registration must be blocked (HTTP 409 Conflict)
    const dupRes = await fetch(`${baseUrl}/api/patients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Patient',
        email: 'patienta@test.com',
      }),
    });
    assert.strictEqual(dupRes.status, 409);

    // Initialized NotificationPreference must have notifications & consent disabled by default
    const pref = await NotificationPreference.findOne({ patientId: patientA_id });
    assert.ok(pref);
    assert.strictEqual(pref.patientEmail, 'patienta@test.com');
    assert.strictEqual(pref.allNotificationsEnabled, false);
    assert.strictEqual(pref.patientConsent, false);
  });

  // ================= 2. Email Reuse in Notification Settings =================
  await t.test('2. Email Reuse: Pre-fills registered email in settings without asking user to re-enter', async () => {
    const settingsRes = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      headers: { Authorization: `Bearer ${patientA_id}` },
    });
    assert.strictEqual(settingsRes.status, 200);
    const data = await settingsRes.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.patientEmail, 'patienta@test.com');
    assert.strictEqual(data.data.patientName, 'Patient A');
  });

  // ================= 3. RBAC & Patient-to-Patient Isolation =================
  await t.test('3. RBAC & Data Isolation: Patients cannot view other profiles or spoof patient IDs', async () => {
    // Register Patient B
    await fetch(`${baseUrl}/api/patients/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: patientB_id,
        name: 'Patient B',
        email: 'patientb@test.com',
        timezone: 'Asia/Kolkata',
      }),
    });

    // Patient A tries to spoof Patient B's settings via target patient header
    const spoofRes = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientA_id}`,
        'x-target-patient-id': patientB_id,
      },
      body: JSON.stringify({
        patientId: patientB_id,
        patientEmail: 'malicious@test.com',
      }),
    });
    assert.strictEqual(spoofRes.status, 403);

    // Verify Patient B remained completely untouched
    const bCheck = await NotificationPreference.findOne({ patientId: patientB_id });
    assert.strictEqual(bCheck.patientEmail, 'patientb@test.com');

    // Ordinary patient cannot list other patients
    const listRes = await fetch(`${baseUrl}/api/patients`, {
      headers: { Authorization: `Bearer ${patientA_id}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    // Returns ONLY their own single profile
    assert.strictEqual(listData.count, 1);
    assert.strictEqual(listData.data[0].patientId, patientA_id);
  });

  // ================= 4. Researcher Privileges & Patient Switching =================
  await t.test('4. Researcher Access: Authorized researchers can view all registered patients', async () => {
    // Query with researcher role identity
    const resRes = await fetch(`${baseUrl}/api/patients`, {
      headers: { Authorization: `Bearer ${researcher_jwt}` },
    });
    assert.strictEqual(resRes.status, 200);
    const resData = await resRes.json();
    assert.ok(resData.count >= 2);
  });

  // ================= 5. Demo Patient Safety =================
  await t.test('5. Demo Patient Safety: Restricted seeding and reserved @example.com addresses', async () => {
    const demoRes = await fetch(`${baseUrl}/api/patients/seed-demo`, {
      method: 'POST',
    });
    assert.strictEqual(demoRes.status, 200);
    const data = await demoRes.json();
    assert.ok(data.success);

    // Verify all demo profiles use reserved example.com domains and are marked isDemo: true
    const demoPatients = await Patient.find({ isDemo: true });
    assert.ok(demoPatients.length >= 4);
    for (const dp of demoPatients) {
      assert.ok(dp.email.endsWith('@example.com'));
      assert.strictEqual(dp.isDemo, true);
    }
  });

  // ================= 6. Multi-Patient Independent Backend Scheduler Processing =================
  await t.test('6. Multi-Patient Scheduler: All 4 patients receive their distinct stage educational emails', async () => {
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    // Register Patient C and Patient D
    await Patient.create({
      patientId: patientC_id,
      name: 'Patient C',
      email: 'patientc@test.com',
      role: 'patient',
      predictedStage: 3,
      predictedClass: 'MildDemented',
      stageLabel: 'Moderate Stage',
    });
    await Patient.create({
      patientId: patientD_id,
      name: 'Patient D',
      email: 'patientd@test.com',
      role: 'patient',
      predictedStage: 4,
      predictedClass: 'ModerateDemented',
      stageLabel: 'Critical Stage',
    });

    const patientConfigs = [
      { id: patientA_id, email: 'patienta@test.com', stage: 1, class: 'NonDemented', label: 'Healthy / No Dementia Detected' },
      { id: patientB_id, email: 'patientb@test.com', stage: 2, class: 'VeryMildDemented', label: 'Early Stage' },
      { id: patientC_id, email: 'patientc@test.com', stage: 3, class: 'MildDemented', label: 'Moderate Stage' },
      { id: patientD_id, email: 'patientd@test.com', stage: 4, class: 'ModerateDemented', label: 'Critical Stage' },
    ];

    // Configure eligible preferences with consent for all 4 patients
    for (const p of patientConfigs) {
      await NotificationPreference.findOneAndUpdate(
        { patientId: p.id },
        {
          patientId: p.id,
          patientEmail: p.email,
          allNotificationsEnabled: true,
          patientConsent: true,
          hasEligiblePrediction: true,
          predictedStage: p.stage,
          predictedClass: p.class,
          stageLabel: p.label,
          timezone: 'Asia/Kolkata',
          categories: {
            weeklyEducational: {
              enabled: true,
              weekday,
              time: currentTime,
              topicIndex: 0,
            },
          },
        },
        { upsert: true }
      );
    }

    // Run scheduler for current tick
    const runRes = await processScheduledNotifications(schedulerSecretKey);
    assert.strictEqual(runRes.status, 'success');

    // Verify all 4 patients received their distinct stage educational email at their own address
    for (const p of patientConfigs) {
      const delivery = await NotificationDelivery.findOne({
        patientId: p.id,
        category: 'weeklyEducational',
      });

      assert.ok(delivery, `Delivery record must exist for ${p.id}`);
      assert.strictEqual(delivery.recipientEmail, p.email);
      assert.strictEqual(delivery.metadata.stageNumber, p.stage);
    }
  });

  // ================= 7. Notifications Disabled & No Consent Verification =================
  await t.test('7. Consent Safeguards: Zero emails sent to patients without consent or with notifications disabled', async () => {
    const disabledPatient = `pat-disabled-${Date.now()}`;
    const noConsentPatient = `pat-noconsent-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    // Patient with allNotificationsEnabled = false
    await NotificationPreference.create({
      patientId: disabledPatient,
      patientEmail: 'disabled@test.com',
      allNotificationsEnabled: false,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 1,
      categories: { weeklyEducational: { enabled: true, weekday, time: currentTime } },
    });

    // Patient with patientConsent = false
    await NotificationPreference.create({
      patientId: noConsentPatient,
      patientEmail: 'noconsent@test.com',
      allNotificationsEnabled: true,
      patientConsent: false,
      hasEligiblePrediction: true,
      predictedStage: 2,
      categories: { weeklyEducational: { enabled: true, weekday, time: currentTime } },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const dDelivery = await NotificationDelivery.findOne({ patientId: disabledPatient });
    assert.strictEqual(dDelivery, null, 'Must NOT deliver when allNotificationsEnabled is false');

    const cDelivery = await NotificationDelivery.findOne({ patientId: noConsentPatient });
    assert.strictEqual(cDelivery, null, 'Must NOT deliver when patientConsent is false');
  });

  // ================= 8. Missing Eligible Prediction Safeguard =================
  await t.test('8. Missing Prediction Safeguard: Patient without eligible prediction receives zero stage educational emails', async () => {
    const noPredPatient = `pat-nopred-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: noPredPatient,
      patientEmail: 'nopred@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: false,
      predictedStage: null,
      categories: { weeklyEducational: { enabled: true, weekday, time: currentTime } },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const delivery = await NotificationDelivery.findOne({
      patientId: noPredPatient,
      category: 'weeklyEducational',
    });
    assert.strictEqual(delivery, null, 'Must NOT send weekly educational email without eligible prediction');
  });

  // ================= 9. Timezone Schedule Localization =================
  await t.test('9. Timezone Localization: Evaluates patient schedule in their own configured timezone', async () => {
    const tzPatientNY = `pat-tz-ny-${Date.now()}`;
    const { timeStr: nyTimeStr, weekday: nyWeekday } = getPatientCurrentDateTime('America/New_York');
    const nyTime = normalizeTimeStr(nyTimeStr);

    await NotificationPreference.create({
      patientId: tzPatientNY,
      patientEmail: 'ny@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 1,
      timezone: 'America/New_York',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday: nyWeekday,
          time: nyTime,
        },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const delivery = await NotificationDelivery.findOne({
      patientId: tzPatientNY,
      category: 'weeklyEducational',
    });
    assert.ok(delivery, 'New York timezone scheduled patient must receive email at their local time');
  });

  // ================= 10. Caregiver Authorization Gates =================
  await t.test('10. Caregiver Authorization: Dispatches only when all caregiver consent gates pass', async () => {
    const cgPatient = `pat-cg-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: cgPatient,
      patientEmail: 'patcg@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 3,
      timezone: 'Asia/Kolkata',
      caregiverEmail: 'cg@test.com',
      caregiverEnabled: true,
      caregiverConsent: true,
      caregiverSettings: { weeklyEducational: true },
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday,
          time: currentTime,
          topicIndex: 0,
        },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const cgDelivery = await NotificationDelivery.findOne({
      patientId: cgPatient,
      recipient: 'caregiver',
      category: 'weeklyEducational',
    });
    assert.ok(cgDelivery, 'Caregiver delivery record must exist');
    assert.strictEqual(cgDelivery.recipientEmail, 'cg@test.com');
  });

  // ================= 11. Duplicate Prevention =================
  await t.test('11. Duplicate Prevention: Sequential or concurrent scheduler triggers produce zero duplicate emails', async () => {
    const dupPatient = `pat-dup-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: dupPatient,
      patientEmail: 'dup@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 2,
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday,
          time: currentTime,
          topicIndex: 0,
        },
      },
    });

    // Run 3 sequential / parallel triggers
    await Promise.all([
      processScheduledNotifications(schedulerSecretKey),
      processScheduledNotifications(schedulerSecretKey),
    ]);
    await processScheduledNotifications(schedulerSecretKey);

    const count = await NotificationDelivery.countDocuments({
      patientId: dupPatient,
      category: 'weeklyEducational',
    });
    assert.strictEqual(count, 1, 'Exactly one delivery record must exist despite repeated triggers');
  });

  await t.test('Teardown: Close test server and clean up', async () => {
    await Patient.deleteMany({ email: /@test\.com$/ });
    await NotificationPreference.deleteMany({ patientEmail: /@test\.com$/ });
    await NotificationDelivery.deleteMany({ recipientEmail: /@test\.com$/ });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
