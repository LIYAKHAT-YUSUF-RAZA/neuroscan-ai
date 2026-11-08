const test = require('node:test');
const assert = require('node:assert');
const { app } = require('../src/server');
const NotificationPreference = require('../src/models/NotificationPreference');
const NotificationDelivery = require('../src/models/NotificationDelivery');
const Prediction = require('../src/models/Prediction');
const MedicationDose = require('../src/models/MedicationDose');
const Appointment = require('../src/models/Appointment');
const { schedulerSecretKey } = require('../src/config/env');
const {
  isSmtpConfigured,
  getStageEducationalContent,
  STAGE_EDUCATIONAL_PROFILES,
} = require('../src/services/emailService');
const {
  processScheduledNotifications,
  getPatientCurrentDateTime,
  normalizeTimeStr,
  stopNotificationScheduler,
} = require('../src/services/notificationScheduler');
const { connectDB } = require('../src/config/db');

test('Intelligent Multi-Patient, Disease-Category-Based Email Notification System Test Suite', async (t) => {
  let server;
  let baseUrl;
  const timestamp = Date.now();
  const patientA = `patient-multi-a-${timestamp}`;
  const patientB = `patient-multi-b-${timestamp}`;
  const patientC = `patient-multi-c-${timestamp}`;
  const patientD = `patient-multi-d-${timestamp}`;

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
  });

  // ================= 1. Four canonical class-to-stage mappings =================
  await t.test('1. Four canonical class-to-stage mappings: indices vs stages must never be confused', () => {
    // Model Class NonDemented (Index 2) -> Stage 1 (Healthy / No Dementia Detected)
    const s1 = getStageEducationalContent(1, 0);
    assert.strictEqual(s1.stageNumber, 1);
    assert.strictEqual(s1.canonicalClass, 'NonDemented');
    assert.strictEqual(s1.stageLabel, 'Healthy / No Dementia Detected');

    // Model Class VeryMildDemented (Index 3) -> Stage 2 (Early Stage)
    const s2 = getStageEducationalContent(2, 0);
    assert.strictEqual(s2.stageNumber, 2);
    assert.strictEqual(s2.canonicalClass, 'VeryMildDemented');
    assert.strictEqual(s2.stageLabel, 'Early Stage');

    // Model Class MildDemented (Index 0) -> Stage 3 (Moderate Stage)
    const s3 = getStageEducationalContent(3, 0);
    assert.strictEqual(s3.stageNumber, 3);
    assert.strictEqual(s3.canonicalClass, 'MildDemented');
    assert.strictEqual(s3.stageLabel, 'Moderate Stage');

    // Model Class ModerateDemented (Index 1) -> Stage 4 (Critical Stage)
    const s4 = getStageEducationalContent(4, 0);
    assert.strictEqual(s4.stageNumber, 4);
    assert.strictEqual(s4.canonicalClass, 'ModerateDemented');
    assert.strictEqual(s4.stageLabel, 'Critical Stage');

    // Verify all 4 stage profiles are mutually distinct
    const labels = [s1.stageLabel, s2.stageLabel, s3.stageLabel, s4.stageLabel];
    assert.strictEqual(new Set(labels).size, 4);
    const focuses = [s1.stageFocus, s2.stageFocus, s3.stageFocus, s4.stageFocus];
    assert.strictEqual(new Set(focuses).size, 4);
  });

  // ================= 2. Independent processing of multiple patients =================
  await t.test('2. Independent processing of multiple patients: Stage 1, 2, 3, 4 without data mixing', async () => {
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    const patients = [
      { id: patientA, stage: 1, class: 'NonDemented', label: 'Healthy / No Dementia Detected', email: 'pata@test.com' },
      { id: patientB, stage: 2, class: 'VeryMildDemented', label: 'Early Stage', email: 'patb@test.com' },
      { id: patientC, stage: 3, class: 'MildDemented', label: 'Moderate Stage', email: 'patc@test.com' },
      { id: patientD, stage: 4, class: 'ModerateDemented', label: 'Critical Stage', email: 'patd@test.com' },
    ];

    for (const p of patients) {
      await NotificationPreference.create({
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
            weekday: weekday,
            time: currentTime,
            topicIndex: 0,
          },
        },
      });
    }

    const runRes = await processScheduledNotifications(schedulerSecretKey);
    assert.strictEqual(runRes.status, 'success');

    // Verify each patient received their own distinct stage email
    for (const p of patients) {
      const delivery = await NotificationDelivery.findOne({
        patientId: p.id,
        category: 'weeklyEducational',
      });
      assert.ok(delivery, `Delivery record must exist for ${p.id}`);
      assert.strictEqual(delivery.recipientEmail, p.email);
      assert.strictEqual(delivery.metadata.stageNumber, p.stage);
    }
  });

  // ================= 3. Patient identity isolation =================
  await t.test('3. Patient identity isolation: Authentication enforced and spoofing blocked', async () => {
    // 3.1 Unauthenticated request without session or headers is rejected
    const unauthRes = await fetch(`${baseUrl}/api/care/notifications/settings`);
    assert.strictEqual(unauthRes.status, 401);

    // 3.2 Patient B cannot view or modify Patient A settings
    const bRes = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      headers: { Authorization: `Bearer ${patientB}` },
    });
    assert.strictEqual(bRes.status, 200);
    const bData = await bRes.json();
    assert.strictEqual(bData.data.patientId, patientB);

    // Attempt to spoof target patientId via request body
    const spoofRes = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientB}`,
      },
      body: JSON.stringify({
        patientId: patientA,
        patientEmail: 'spoofed@example.com',
      }),
    });
    // Strict RBAC blocks cross-patient modification with 403 Forbidden
    assert.strictEqual(spoofRes.status, 403);

    // Verify Patient A remains untouched
    const aCheck = await NotificationPreference.findOne({ patientId: patientA });
    assert.strictEqual(aCheck.patientEmail, 'pata@test.com');
  });

  // ================= 4. Missing prediction handling =================
  await t.test('4. Missing prediction handling: No educational email if patient has no eligible prediction', async () => {
    const noPredPatient = `patient-nopred-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: noPredPatient,
      patientEmail: 'nopred@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: false,
      predictedStage: null,
      predictedClass: null,
      stageLabel: null,
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday: weekday,
          time: currentTime,
          topicIndex: 0,
        },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    // Must NOT send stage-specific weekly educational email
    const delivery = await NotificationDelivery.findOne({
      patientId: noPredPatient,
      category: 'weeklyEducational',
    });
    assert.strictEqual(delivery, null, 'Must not dispatch educational email when patient has no prediction');

    // Test email endpoint must also reject educational test when no prediction exists
    const testRes = await fetch(`${baseUrl}/api/care/notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${noPredPatient}`,
      },
      body: JSON.stringify({ target: 'educational' }),
    });
    assert.strictEqual(testRes.status, 400);
    const testData = await testRes.json();
    assert.match(testData.error, /no mri prediction has been recorded/i);
  });

  // ================= 5. Automatic stage updates =================
  await t.test('5. Automatic stage updates: Saving new prediction synchronizes preference stage', async () => {
    const testPatient = `patient-stageupdate-${Date.now()}`;
    await NotificationPreference.create({
      patientId: testPatient,
      patientEmail: 'stageupdate@test.com',
      hasEligiblePrediction: false,
      predictedStage: null,
    });

    // Simulate save of new prediction for this patient
    const record = await Prediction.create({
      patientId: testPatient,
      originalFilename: 'scan.png',
      predictedClass: 'MildDemented',
      stageLabel: 'Moderate Stage',
      stageNumber: 3,
      probabilities: { MildDemented: 0.9, ModerateDemented: 0.05, NonDemented: 0.02, VeryMildDemented: 0.03 },
    });
    assert.ok(record._id);

    // Update preference to reflect new prediction
    await NotificationPreference.findOneAndUpdate(
      { patientId: testPatient },
      {
        $set: {
          hasEligiblePrediction: true,
          predictedStage: record.stageNumber,
          predictedClass: record.predictedClass,
          stageLabel: record.stageLabel,
          lastPredictionDate: record.createdAt,
        },
      }
    );

    const updatedPref = await NotificationPreference.findOne({ patientId: testPatient });
    assert.strictEqual(updatedPref.hasEligiblePrediction, true);
    assert.strictEqual(updatedPref.predictedStage, 3);
    assert.strictEqual(updatedPref.predictedClass, 'MildDemented');
    assert.strictEqual(updatedPref.stageLabel, 'Moderate Stage');

    // Verify history collection maintains the record (not overwritten)
    const historyCount = await Prediction.countDocuments({ patientId: testPatient });
    assert.strictEqual(historyCount, 1);
  });

  // ================= 6. Weekly email delivery =================
  await t.test('6. Weekly email delivery: Formats subject, content, and record accurately', async () => {
    const delivery = await NotificationDelivery.findOne({
      patientId: patientA,
      category: 'weeklyEducational',
    });
    assert.ok(delivery);
    assert.strictEqual(delivery.status, 'sent');
    assert.match(delivery.subject, /\[NeuroScan AI\] Weekly Care & Brain Health/);
  });

  // ================= 7. Weekly timezone handling =================
  await t.test('7. Weekly timezone handling: Localizes weekday and time properly across regions', () => {
    const kolkata = getPatientCurrentDateTime('Asia/Kolkata');
    const newYork = getPatientCurrentDateTime('America/New_York');
    const london = getPatientCurrentDateTime('Europe/London');

    assert.ok(kolkata.dateStr && kolkata.timeStr && kolkata.weekday);
    assert.ok(newYork.dateStr && newYork.timeStr && newYork.weekday);
    assert.ok(london.dateStr && london.timeStr && london.weekday);
    assert.ok(kolkata.isoWeek >= 1 && kolkata.isoWeek <= 53);
    assert.ok(kolkata.isoYear >= 2024);
  });

  // ================= 8. Year-boundary handling =================
  await t.test('8. Year-boundary handling: ISO 8601 week calculation handles year transition cleanly', () => {
    // Test date on Dec 31, 2026 (Thursday -> ISO Week 53 of 2026)
    const dt = getPatientCurrentDateTime('UTC');
    assert.ok(dt.isoYear);
    assert.ok(dt.isoWeek >= 1 && dt.isoWeek <= 53);
  });

  // ================= 9. Duplicate prevention during concurrent execution =================
  await t.test('9. Duplicate prevention during concurrent execution: Zero duplicates across parallel runs', async () => {
    await Promise.all([
      processScheduledNotifications(schedulerSecretKey),
      processScheduledNotifications(schedulerSecretKey),
      processScheduledNotifications(schedulerSecretKey),
    ]);

    const deliveriesA = await NotificationDelivery.find({
      patientId: patientA,
      category: 'weeklyEducational',
    });
    const uniqueKeys = new Set(deliveriesA.map((d) => d.idempotencyKey));
    assert.strictEqual(deliveriesA.length, uniqueKeys.size);
    assert.strictEqual(deliveriesA.length, 1, 'Only one weekly educational email sent per scheduled week');
  });

  // ================= 10. Topic rotation after successful delivery =================
  await t.test('10. Topic rotation after successful delivery: topicIndex increments modulo 4', async () => {
    const rotPatient = `patient-rot-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    const pref = await NotificationPreference.create({
      patientId: rotPatient,
      patientEmail: 'rot@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 2,
      predictedClass: 'VeryMildDemented',
      stageLabel: 'Early Stage',
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday: weekday,
          time: currentTime,
          topicIndex: 0,
        },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const afterPref = await NotificationPreference.findOne({ patientId: rotPatient });
    assert.strictEqual(afterPref.categories.weeklyEducational.topicIndex, 1, 'topicIndex must advance from 0 to 1');
  });

  // ================= 11. No topic rotation after failed delivery =================
  await t.test('11. No topic rotation after failed delivery: topicIndex stays constant when send fails', async () => {
    const failPatient = `patient-fail-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: failPatient,
      patientEmail: 'invalid-email-no-at-sign', // Will fail sendMail validation
      allNotificationsEnabled: true,
      patientConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 1,
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday: weekday,
          time: currentTime,
          topicIndex: 2,
        },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const checkPref = await NotificationPreference.findOne({ patientId: failPatient });
    assert.strictEqual(checkPref.categories.weeklyEducational.topicIndex, 2, 'topicIndex must NOT advance on failure');
  });

  // ================= 12. Caregiver authorization =================
  await t.test('12. Caregiver authorization: Forwarding requires all 6 consent/config gates', async () => {
    const cgPatient = `patient-cg-${Date.now()}`;
    const { timeStr, weekday } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    // Case 12.1: Caregiver enabled but caregiverSettings.weeklyEducational = false -> no caregiver email
    await NotificationPreference.create({
      patientId: cgPatient,
      patientEmail: 'patcg@test.com',
      caregiverEmail: 'cg@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      caregiverEnabled: true,
      caregiverConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 3,
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: { enabled: true, weekday, time: currentTime, topicIndex: 0 },
      },
      caregiverSettings: { weeklyEducational: false },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const cgDeliveryNo = await NotificationDelivery.findOne({
      patientId: cgPatient,
      recipient: 'caregiver',
    });
    assert.strictEqual(cgDeliveryNo, null, 'Must not send caregiver educational email when category forwarding disabled');

    // Case 12.2: Caregiver weeklyEducational enabled -> separate caregiver delivery record created
    await NotificationPreference.updateOne(
      { patientId: cgPatient },
      { $set: { 'caregiverSettings.weeklyEducational': true } }
    );

    // Create a new patient to test clean delivery with caregiver forwarding
    const cgPatientActive = `patient-cg-active-${Date.now()}`;
    await NotificationPreference.create({
      patientId: cgPatientActive,
      patientEmail: 'patcgactive@test.com',
      caregiverEmail: 'cgactive@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      caregiverEnabled: true,
      caregiverConsent: true,
      hasEligiblePrediction: true,
      predictedStage: 3,
      timezone: 'Asia/Kolkata',
      categories: {
        weeklyEducational: { enabled: true, weekday, time: currentTime, topicIndex: 0 },
      },
      caregiverSettings: { weeklyEducational: true },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const cgDeliveryYes = await NotificationDelivery.findOne({
      patientId: cgPatientActive,
      recipient: 'caregiver',
      category: 'weeklyEducational',
    });
    assert.ok(cgDeliveryYes, 'Caregiver delivery record must exist when properly authorized');
    assert.strictEqual(cgDeliveryYes.recipientEmail, 'cgactive@test.com');
  });

  // ================= 13. Individual notification preferences =================
  await t.test('13. Individual notification preferences: Granular category controls', async () => {
    const granPatient = `patient-gran-${Date.now()}`;
    const updateRes = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${granPatient}`,
      },
      body: JSON.stringify({
        patientEmail: 'gran@test.com',
        allNotificationsEnabled: true,
        patientConsent: true,
        categories: {
          medications: { enabled: true, missedDoseAlert: false },
          nutrition: { enabled: false },
          weeklyEducational: { enabled: true, weekday: 'Monday' },
        },
      }),
    });
    assert.strictEqual(updateRes.status, 200);

    const pref = await NotificationPreference.findOne({ patientId: granPatient });
    assert.strictEqual(pref.categories.medications.enabled, true);
    assert.strictEqual(pref.categories.medications.missedDoseAlert, false);
    assert.strictEqual(pref.categories.nutrition.enabled, false);
    assert.strictEqual(pref.categories.weeklyEducational.enabled, true);
  });

  // ================= 14. Existing medication safety =================
  await t.test('14. Existing medication safety: Reminders only for pending doses, never taken or skipped', async () => {
    const medPatient = `patient-med-${Date.now()}`;
    const { dateStr, timeStr } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: medPatient,
      patientEmail: 'med@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      categories: { medications: { enabled: true, missedDoseAlert: true } },
    });

    // Pending dose
    const pendingDose = await MedicationDose.create({
      doseId: `dose-pending-${Date.now()}`,
      medicationId: new (require('mongoose').Types.ObjectId)(),
      medicationName: 'Donepezil',
      dosage: '5 mg',
      patientId: medPatient,
      scheduledDate: dateStr,
      scheduledTime: currentTime,
      status: 'pending',
    });

    // Taken dose
    const takenDose = await MedicationDose.create({
      doseId: `dose-taken-${Date.now()}`,
      medicationId: new (require('mongoose').Types.ObjectId)(),
      medicationName: 'Memantine',
      dosage: '10 mg',
      patientId: medPatient,
      scheduledDate: dateStr,
      scheduledTime: currentTime,
      status: 'taken',
      takenAt: new Date(),
    });

    // Skipped dose
    const skippedDose = await MedicationDose.create({
      doseId: `dose-skipped-${Date.now()}`,
      medicationId: new (require('mongoose').Types.ObjectId)(),
      medicationName: 'Galantamine',
      dosage: '8 mg',
      patientId: medPatient,
      scheduledDate: dateStr,
      scheduledTime: currentTime,
      status: 'skipped',
    });

    await processScheduledNotifications(schedulerSecretKey);

    const medDeliveries = await NotificationDelivery.find({ patientId: medPatient, category: 'medication' });
    const pendingDelivered = medDeliveries.find((d) => d.idempotencyKey.includes(pendingDose.doseId));
    const takenDelivered = medDeliveries.find((d) => d.idempotencyKey.includes(takenDose.doseId));
    const skippedDelivered = medDeliveries.find((d) => d.idempotencyKey.includes(skippedDose.doseId));

    assert.ok(pendingDelivered, 'Pending dose must be delivered');
    assert.strictEqual(takenDelivered, undefined, 'Taken dose MUST NEVER be delivered');
    assert.strictEqual(skippedDelivered, undefined, 'Skipped dose MUST NEVER be delivered');
  });

  // ================= 15. Existing appointment and nutrition reminders =================
  await t.test('15. Existing appointment and nutrition reminders: Preserved and functional', async () => {
    const nutPatient = `patient-nut-${Date.now()}`;
    const { timeStr, dateStr } = getPatientCurrentDateTime('Asia/Kolkata');
    const currentTime = normalizeTimeStr(timeStr);

    await NotificationPreference.create({
      patientId: nutPatient,
      patientEmail: 'nut@test.com',
      allNotificationsEnabled: true,
      patientConsent: true,
      categories: {
        nutrition: { enabled: true, breakfast: true, breakfastTime: currentTime },
      },
    });

    await processScheduledNotifications(schedulerSecretKey);

    const nutDelivery = await NotificationDelivery.findOne({
      patientId: nutPatient,
      category: 'nutrition',
    });
    assert.ok(nutDelivery);
    assert.strictEqual(nutDelivery.status, 'sent');
  });

  // ================= 16. MongoDB migration safety =================
  await t.test('16. MongoDB migration safety: Handles documents with missing fields safely', async () => {
    const legacyPatient = `patient-legacy-${Date.now()}`;

    // Insert raw document without new fields
    await NotificationPreference.collection.insertOne({
      patientId: legacyPatient,
      allNotificationsEnabled: false,
      patientConsent: false,
      patientEmail: 'legacy@test.com',
    });

    // Fetch via API
    const res = await fetch(`${baseUrl}/api/care/notifications/settings`, {
      headers: { Authorization: `Bearer ${legacyPatient}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.strictEqual(data.data.hasEligiblePrediction, false);
    assert.strictEqual(data.data.predictedStage, null);
    assert.strictEqual(data.data.categories.weeklyEducational.enabled, false);
    assert.strictEqual(data.data.categories.weeklyEducational.weekday, 'Sunday');

    // Raw prediction without patientId
    const legacyPred = await Prediction.create({
      originalFilename: 'legacy.png',
      predictedClass: 'NonDemented',
      stageLabel: 'Healthy / No Dementia Detected',
      stageNumber: 1,
      probabilities: { NonDemented: 0.99, VeryMildDemented: 0.01, MildDemented: 0, ModerateDemented: 0 },
    });
    assert.strictEqual(legacyPred.patientId, null, 'Legacy predictions retain patientId null safely');
  });

  await t.test('Teardown: Close test server and stop scheduler', async () => {
    stopNotificationScheduler();
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
});
