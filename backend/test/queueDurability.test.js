/**
 * Asynchronous Queue Durability, Crash Recovery, and RBAC Test Suite
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const InferenceJob = require('../src/models/InferenceJob');
const { recoverStuckJobs, getJobStatus } = require('../src/controllers/jobController');

describe('Asynchronous Queue Durability & RBAC Integrity', () => {
  before(async () => {
    await connectDB();
    await InferenceJob.deleteMany({ jobId: /^durability_test_/ });
  });

  after(async () => {
    await InferenceJob.deleteMany({ jobId: /^durability_test_/ });
    await mongoose.connection.close();
  });

  test('1. Orphaned jobs in "queued" or "processing" are safely recovered after simulated server restart', async () => {
    // Create simulated in-flight jobs that were interrupted by a process termination
    await InferenceJob.create([
      {
        jobId: 'durability_test_queued_1',
        patientId: 'patient_alpha',
        status: 'queued',
        progress: 0,
      },
      {
        jobId: 'durability_test_processing_2',
        patientId: 'patient_beta',
        status: 'processing',
        progress: 20,
        startedAt: new Date(Date.now() - 60000),
      },
      {
        jobId: 'durability_test_completed_3',
        patientId: 'patient_gamma',
        status: 'completed',
        progress: 100,
        result: { stageNumber: 1, prediction: 'NonDemented' },
        completedAt: new Date(Date.now() - 30000),
      },
    ]);

    // Execute startup recovery
    const recoveredCount = await recoverStuckJobs();
    assert.strictEqual(recoveredCount, 2, 'Must recover exactly the 2 uncompleted jobs');

    // Verify status transitions
    const job1 = await InferenceJob.findOne({ jobId: 'durability_test_queued_1' });
    assert.strictEqual(job1.status, 'failed');
    assert.match(job1.error, /interrupted by a server restart/);
    assert.ok(job1.completedAt);

    const job2 = await InferenceJob.findOne({ jobId: 'durability_test_processing_2' });
    assert.strictEqual(job2.status, 'failed');
    assert.match(job2.error, /interrupted by a server restart/);

    // Verify completed job was preserved untouched
    const job3 = await InferenceJob.findOne({ jobId: 'durability_test_completed_3' });
    assert.strictEqual(job3.status, 'completed');
    assert.strictEqual(job3.error, null);
  });

  test('2. RBAC isolation: Cross-patient polling returns 403 Forbidden', async () => {
    await InferenceJob.create({
      jobId: 'durability_test_rbac_job',
      patientId: 'patient_owner_123',
      status: 'completed',
      progress: 100,
      result: { prediction: 'MildDemented' },
    });

    const mockReqCross = {
      params: { jobId: 'durability_test_rbac_job' },
      headers: {},
      user: { patientId: 'patient_attacker_999', role: 'patient' },
    };

    let statusCode = null;
    let responseBody = null;
    const mockRes = {
      status(c) {
        statusCode = c;
        return this;
      },
      json(b) {
        responseBody = b;
        return this;
      },
    };

    await getJobStatus(mockReqCross, mockRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(statusCode, 403, 'Cross-patient job status access must return 403');
    assert.match(responseBody.error, /Forbidden/);

    // Legitimate patient access returns 200
    const mockReqOwner = {
      params: { jobId: 'durability_test_rbac_job' },
      headers: {},
      user: { patientId: 'patient_owner_123', role: 'patient' },
    };

    await getJobStatus(mockReqOwner, mockRes, (err) => {
      if (err) throw err;
    });
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseBody.jobId, 'durability_test_rbac_job');
  });
});
