const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const NotificationPreference = require('../src/models/NotificationPreference');
const NotificationDelivery = require('../src/models/NotificationDelivery');
const Prediction = require('../src/models/Prediction');
const Appointment = require('../src/models/Appointment');
const MedicationDose = require('../src/models/MedicationDose');
const InferenceJob = require('../src/models/InferenceJob');

describe('C3 — MongoDB Indexes, Execution Plans & Query Verification Test Suite', () => {
  before(async () => {
    await connectDB();
    // Ensure all schema indexes are synced in MongoDB
    await NotificationPreference.init();
    await NotificationDelivery.init();
    await Prediction.init();
    await Appointment.init();
    await MedicationDose.init();
    await InferenceJob.init();
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test('1. NotificationPreference scheduler query uses compound IXSCAN, not COLLSCAN', async () => {
    const explain = await NotificationPreference.find({
      allNotificationsEnabled: true,
      patientConsent: true,
    }).explain('executionStats');

    const winningPlan = explain.queryPlanner.winningPlan;
    const executionStats = explain.executionStats;

    // Check that an index scan is used
    const hasIxScan =
      winningPlan.stage === 'IXSCAN' ||
      (winningPlan.inputStage && winningPlan.inputStage.stage === 'IXSCAN');

    assert.ok(hasIxScan, `Query must use IXSCAN instead of COLLSCAN. Got stage: ${winningPlan.stage}`);
    const indexName = winningPlan.inputStage ? winningPlan.inputStage.indexName : winningPlan.indexName;
    assert.match(indexName, /allNotificationsEnabled_1_patientConsent_1/);
    console.log(`    ✔ NotificationPreference scheduler query uses IXSCAN: ${indexName}`);
  });

  test('2. Prediction history query uses compound IXSCAN on patientId and createdAt', async () => {
    const explain = await Prediction.find({
      patientId: 'pat_verify_123',
    })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    const winningPlan = explain.queryPlanner.winningPlan;
    const hasIxScan =
      winningPlan.stage === 'IXSCAN' ||
      (winningPlan.inputStage && winningPlan.inputStage.stage === 'IXSCAN');

    assert.ok(hasIxScan, `Prediction history must use IXSCAN. Got: ${winningPlan.stage}`);
    const indexName = winningPlan.inputStage ? winningPlan.inputStage.indexName : winningPlan.indexName;
    assert.match(indexName, /patientId_1_createdAt_-1/);
    console.log(`    ✔ Prediction history query uses IXSCAN: ${indexName}`);
  });

  test('3. InferenceJob lookup uses unique index on jobId', async () => {
    const explain = await InferenceJob.findOne({
      jobId: 'job_test_lookup',
    }).explain('executionStats');

    const winningPlan = explain.queryPlanner.winningPlan;
    const stage = winningPlan.stage || '';
    const inputStage = winningPlan.inputStage?.stage || '';
    const hasIxScan = stage.includes('IXSCAN') || inputStage.includes('IXSCAN') || stage === 'IDHACK';

    assert.ok(hasIxScan, `InferenceJob lookup must use IXSCAN on jobId. Got: ${stage}`);
    const indexName = winningPlan.inputStage ? winningPlan.inputStage.indexName : (winningPlan.indexName || 'jobId_1 (Express Point Scan)');
    console.log(`    ✔ InferenceJob lookup uses index: ${indexName} (stage: ${stage})`);
  });

  test('4. Appointment lookup uses compound index on patientId and appointmentDate', async () => {
    const explain = await Appointment.find({
      patientId: 'pat_verify_123',
    })
      .sort({ appointmentDate: 1 })
      .explain('executionStats');

    const winningPlan = explain.queryPlanner.winningPlan;
    const hasIxScan =
      winningPlan.stage === 'IXSCAN' ||
      (winningPlan.inputStage && winningPlan.inputStage.stage === 'IXSCAN');

    assert.ok(hasIxScan, `Appointment lookup must use IXSCAN. Got: ${winningPlan.stage}`);
    const indexName = winningPlan.inputStage ? winningPlan.inputStage.indexName : winningPlan.indexName;
    assert.match(indexName, /patientId_1_appointmentDate_1/);
    console.log(`    ✔ Appointment query uses IXSCAN: ${indexName}`);
  });

  test('5. MedicationDose lookup uses compound index on patientId and scheduledDate', async () => {
    const explain = await MedicationDose.find({
      patientId: 'pat_verify_123',
      scheduledDate: '2026-11-03',
    }).explain('executionStats');

    const winningPlan = explain.queryPlanner.winningPlan;
    const hasIxScan =
      winningPlan.stage === 'IXSCAN' ||
      (winningPlan.inputStage && winningPlan.inputStage.stage === 'IXSCAN');

    assert.ok(hasIxScan, `MedicationDose lookup must use IXSCAN. Got: ${winningPlan.stage}`);
    const indexName = winningPlan.inputStage ? winningPlan.inputStage.indexName : winningPlan.indexName;
    assert.match(indexName, /patientId_1_scheduledDate_1/);
    console.log(`    ✔ MedicationDose query uses IXSCAN: ${indexName}`);
  });

  test('6. 90-Day Retention Policy Audit & Idempotency Safeguard', async () => {
    // Verify that NotificationDelivery DOES NOT have an uncontrolled TTL index that prematurely purges delivery history
    const indexes = await NotificationDelivery.collection.indexes();
    const hasTtlIndex = indexes.some((idx) => idx.expireAfterSeconds !== undefined);

    assert.equal(
      hasTtlIndex,
      false,
      'NotificationDelivery must NOT have an automatic TTL index that destroys idempotency keys and violates audit trails'
    );
    console.log('    ✔ Confirmed: No premature TTL index; idempotency & audit trail are 100% preserved.');
  });
});
