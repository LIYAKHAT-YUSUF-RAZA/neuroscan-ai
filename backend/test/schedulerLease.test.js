const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const {
  processScheduledNotifications,
  acquireDistributedLock,
} = require('../src/services/notificationScheduler');
const NotificationPreference = require('../src/models/NotificationPreference');
const NotificationDelivery = require('../src/models/NotificationDelivery');
const Prediction = require('../src/models/Prediction');
const { schedulerSecretKey } = require('../src/config/env');

describe('C4 — Distributed Scheduler Lease Lock & Multi-Instance Resilience Test Suite', () => {
  before(async () => {
    await connectDB();
    // Clean test collection
    if (mongoose.connection?.collection('system_scheduler_locks')) {
      await mongoose.connection.collection('system_scheduler_locks').deleteMany({
        _id: { $regex: /^test_/ },
      });
    }
  });

  after(async () => {
    if (mongoose.connection?.collection('system_scheduler_locks')) {
      await mongoose.connection.collection('system_scheduler_locks').deleteMany({
        _id: { $regex: /^test_/ },
      });
    }
    await mongoose.disconnect();
  });

  test('1. First backend instance successfully acquires distributed lease lock', async () => {
    const lockKey = `test_lock_instance_${Date.now()}`;
    const acquired = await acquireDistributedLock(lockKey, 3000);
    assert.equal(acquired, true, 'Instance 1 must successfully acquire unheld lease');

    const lockDoc = await mongoose.connection.collection('system_scheduler_locks').findOne({ _id: lockKey });
    assert.ok(lockDoc);
    assert.equal(lockDoc.instancePid, process.pid);
    assert.ok(new Date(lockDoc.lockedUntil) > new Date());
  });

  test('2. Second concurrent backend replica is strictly rejected while lease is active', async () => {
    const lockKey = `test_lock_concurrent_${Date.now()}`;
    const acquired1 = await acquireDistributedLock(lockKey, 5000);
    assert.equal(acquired1, true, 'First instance must acquire lock');

    // Simulate second replica with different process identifier
    const acquired2 = await acquireDistributedLock(lockKey, 5000);
    assert.equal(acquired2, false, 'Second instance must be rejected while lease is held');
  });

  test('3. Lease expires automatically after TTL, allowing second instance to recover and acquire', async () => {
    const lockKey = `test_lock_expiry_${Date.now()}`;
    // Short lease: 400ms
    const acquired1 = await acquireDistributedLock(lockKey, 400);
    assert.equal(acquired1, true);

    // Immediate second attempt fails
    const acquiredEarly = await acquireDistributedLock(lockKey, 400);
    assert.equal(acquiredEarly, false);

    // Wait 500ms for lease expiration
    await new Promise((r) => setTimeout(r, 500));

    // Second instance now succeeds
    const acquiredAfterExpiry = await acquireDistributedLock(lockKey, 1000);
    assert.equal(acquiredAfterExpiry, true, 'Must acquire lease after previous instance lease expires');
  });

  test('4. Process crash recovery: Stale unrenewed lease allows surviving instance to take over', async () => {
    const lockKey = `test_lock_crash_${Date.now()}`;
    // Manually insert an expired lock document simulating a crashed server
    const pastDate = new Date(Date.now() - 5000);
    await mongoose.connection.collection('system_scheduler_locks').updateOne(
      { _id: lockKey },
      {
        $set: {
          lockedUntil: pastDate,
          acquiredAt: new Date(Date.now() - 60000),
          instancePid: 999999, // Crashed PID
        },
      },
      { upsert: true }
    );

    // Surviving instance attempts acquisition
    const acquired = await acquireDistributedLock(lockKey, 3000);
    assert.equal(acquired, true, 'Surviving instance must seamlessly take over crashed node lease');

    const updatedDoc = await mongoose.connection.collection('system_scheduler_locks').findOne({ _id: lockKey });
    assert.equal(updatedDoc.instancePid, process.pid);
  });

  test('5. Duplicate notification prevention: Parallel scheduler executions produce zero duplicates', async () => {
    const patientId = `pat_sched_dup_${Date.now()}`;

    // Create preference with weekly educational notifications active
    await NotificationPreference.create({
      patientId,
      allNotificationsEnabled: true,
      patientConsent: true,
      patientEmail: 'scheduler_dup@test.com',
      hasEligiblePrediction: true,
      predictedStage: 2,
      predictedClass: 'VeryMildDemented',
      stageLabel: 'Early Stage',
      categories: {
        weeklyEducational: {
          enabled: true,
          weekday: 'Sunday',
          time: '09:00 AM',
          topicIndex: 0,
        },
      },
    });

    await Prediction.create({
      patientId,
      predictedClass: 'VeryMildDemented',
      stageLabel: 'Early Stage',
      stageNumber: 2,
      probabilities: { MildDemented: 0.1, ModerateDemented: 0.1, NonDemented: 0.1, VeryMildDemented: 0.7 },
    });

    // Run 3 scheduler ticks simultaneously (simulating multiple uncoordinated instances)
    const fixedTime = new Date('2026-11-08T03:30:00Z'); // Sunday 9:00 AM IST
    await Promise.all([
      processScheduledNotifications(schedulerSecretKey, { referenceTime: fixedTime }),
      processScheduledNotifications(schedulerSecretKey, { referenceTime: fixedTime }),
      processScheduledNotifications(schedulerSecretKey, { referenceTime: fixedTime }),
    ]);

    // Check delivery records: exactly ONE email must be created despite 3 parallel attempts
    const deliveries = await NotificationDelivery.find({
      patientId,
      category: 'weeklyEducational',
    });

    assert.equal(deliveries.length, 1, 'Exactly one delivery record must exist, zero duplicates allowed');

    // Cleanup
    await NotificationPreference.deleteOne({ patientId });
    await Prediction.deleteMany({ patientId });
    await NotificationDelivery.deleteMany({ patientId });
  });
});
