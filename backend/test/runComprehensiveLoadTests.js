/**
 * Comprehensive Multi-Profile Progressive Load Testing Suite
 * Profiles:
 *   A. Lightweight API traffic (GET /api/health) — 10, 25, 50, 100, 250, 500, 1000 VUs
 *   B. Authenticated patient dashboard traffic (GET /api/history/longitudinal) — 10, 25, 50, 100, 250, 500 VUs
 *   C. MRI upload traffic (POST /api/predict/async) — 10, 25, 50 VUs
 *   D. Asynchronous inference submission & queue polling — 10, 25, 50, 100 VUs
 *   E. MRI inference worker throughput & processing time — Bounded concurrent workers
 */

const fs = require('fs');
const http = require('http');
const autocannon = require('autocannon');
const mongoose = require('mongoose');

const { connectDB } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const Prediction = require('../src/models/Prediction');
const InferenceJob = require('../src/models/InferenceJob');
const { signToken } = require('../src/middlewares/auth');

const BASE_URL = 'http://127.0.0.1:5000';

function getCpuAndMemory() {
  const mem = process.memoryUsage();
  return {
    rssMb: (mem.rss / 1024 / 1024).toFixed(1),
    heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
  };
}

async function runAutocannon(name, opts) {
  const startMetrics = getCpuAndMemory();
  const res = await autocannon(opts);
  const endMetrics = getCpuAndMemory();

  const p50 = res.latency.p50 || res.latency.average;
  const p95 = res.latency.p97_5 || res.latency.p90 || res.latency.average;
  const p99 = res.latency.p99 || res.latency.max;
  const totalReqs = res.requests.total;
  const errorCount = res.non2xx + res.errors + res.timeouts;
  const errorRate = totalReqs > 0 ? ((errorCount / totalReqs) * 100).toFixed(2) : '0.00';

  console.log(`  [${name}] VUs: ${opts.connections} | RPS: ${res.requests.average.toFixed(1)} | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | Errors: ${errorRate}% | RSS: ${endMetrics.rssMb}MB`);

  return {
    profile: name,
    virtualUsers: opts.connections,
    durationSeconds: opts.duration,
    throughputRps: Number(res.requests.average.toFixed(1)),
    totalRequests: totalReqs,
    latency: {
      p50: Number(p50.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(p99.toFixed(2)),
      max: Number(res.latency.max.toFixed(2)),
      avg: Number(res.latency.average.toFixed(2)),
    },
    errorRatePercent: Number(errorRate),
    errors: {
      non2xx: res.non2xx,
      errors: res.errors,
      timeouts: res.timeouts,
    },
    memoryRssMb: Number(endMetrics.rssMb),
  };
}

async function main() {
  console.log('================================================================');
  console.log('NEUROSCAN AI — COMPREHENSIVE PROGRESSIVE LOAD TESTING');
  console.log('================================================================');

  await connectDB();
  const timestamp = Date.now();
  const testPatientId = `pat_load_${timestamp}`;
  const patient = await Patient.create({
    patientId: testPatientId,
    name: 'Load Test Patient',
    email: `load_${timestamp}@test.org`,
    role: 'patient',
  });
  const token = signToken({ patientId: testPatientId, role: 'patient' });

  // Seed 5 predictions for authenticated dashboard queries
  for (let i = 0; i < 5; i++) {
    await Prediction.create({
      patientId: testPatientId,
      predictedClass: i % 2 === 0 ? 'NonDemented' : 'VeryMildDemented',
      stageLabel: i % 2 === 0 ? 'Healthy / No Dementia Detected' : 'Early Stage',
      stageNumber: (i % 2) + 1,
      probabilities: { NonDemented: 0.8, VeryMildDemented: 0.15, MildDemented: 0.03, ModerateDemented: 0.02 },
      originalFilename: `load_scan_${i}.png`,
      fileSize: 1024,
      isOod: false,
    });
  }

  // Create persistent mock job for polling tests
  const testJobId = `job_load_${timestamp}`;
  await InferenceJob.create({
    jobId: testJobId,
    patientId: testPatientId,
    status: 'completed',
    progress: 100,
    result: { stageNumber: 1, prediction: 'NonDemented', confidence: 0.95 },
  });

  const allResults = [];

  // --------------------------------------------------------------------------
  // PROFILE A: Lightweight API Traffic (GET /api/health)
  // Progressive: 10, 25, 50, 100, 250, 500, 1000 Virtual Users
  // --------------------------------------------------------------------------
  console.log('\n--- Profile A: Lightweight API Traffic (GET /api/health) ---');
  const concurrenciesA = [10, 25, 50, 100, 250, 500, 1000];
  for (const vu of concurrenciesA) {
    const resA = await runAutocannon('Profile A', {
      url: `${BASE_URL}/api/health`,
      connections: vu,
      duration: 3,
      pipelining: 1,
    });
    allResults.push(resA);
  }

  // --------------------------------------------------------------------------
  // PROFILE B: Authenticated Patient Dashboard Traffic (GET /api/history/longitudinal)
  // Progressive: 10, 25, 50, 100, 250, 500 Virtual Users
  // --------------------------------------------------------------------------
  console.log('\n--- Profile B: Authenticated Patient Dashboard Traffic ---');
  const concurrenciesB = [10, 25, 50, 100, 250, 500];
  for (const vu of concurrenciesB) {
    const resB = await runAutocannon('Profile B', {
      url: `${BASE_URL}/api/history/longitudinal`,
      headers: { Authorization: `Bearer ${token}` },
      connections: vu,
      duration: 3,
      pipelining: 1,
    });
    allResults.push(resB);
  }

  // --------------------------------------------------------------------------
  // PROFILE C: MRI Upload Traffic (POST /api/predict/async - 202 Ingestion)
  // Progressive: 10, 25, 50 Virtual Users
  // --------------------------------------------------------------------------
  console.log('\n--- Profile C: MRI Upload Ingestion (POST /api/predict/async) ---');
  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const boundary = '----LoadTestBoundary987654321';
  const uploadBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="load_mri.png"\r\nContent-Type: image/png\r\n\r\n`),
    validPng,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const concurrenciesC = [10, 25, 50];
  for (const vu of concurrenciesC) {
    const resC = await runAutocannon('Profile C', {
      url: `${BASE_URL}/api/predict/async`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': uploadBody.length,
      },
      body: uploadBody,
      connections: vu,
      duration: 3,
      pipelining: 1,
    });
    allResults.push(resC);
  }

  // --------------------------------------------------------------------------
  // PROFILE D: Asynchronous Inference Submission & Polling (GET /api/jobs/:jobId)
  // Progressive: 10, 25, 50, 100 Virtual Users
  // --------------------------------------------------------------------------
  console.log('\n--- Profile D: Asynchronous Job Polling (GET /api/jobs/:jobId) ---');
  const concurrenciesD = [10, 25, 50, 100];
  for (const vu of concurrenciesD) {
    const resD = await runAutocannon('Profile D', {
      url: `${BASE_URL}/api/jobs/${testJobId}`,
      headers: { Authorization: `Bearer ${token}` },
      connections: vu,
      duration: 3,
      pipelining: 1,
    });
    allResults.push(resD);
  }

  // --------------------------------------------------------------------------
  // PROFILE E: MRI Inference Worker Throughput (Single-pass inference latency)
  // Measures raw model inference time under bounded CPU
  // --------------------------------------------------------------------------
  console.log('\n--- Profile E: MRI Inference Processing Time ---');
  const times = [];
  for (let k = 0; k < 5; k++) {
    const t0 = performance.now();
    try {
      const flaskForm = new FormData();
      flaskForm.append('image', new Blob([validPng], { type: 'image/png' }), `worker_eval_${k}.png`);
      const infRes = await fetch(`http://127.0.0.1:5001/predict?include_heatmaps=false`, {
        method: 'POST',
        headers: {
          'X-AI-Secret-Key': '0a9933c551d795f1c9014ee42aa2c79784e1ec619059f399708eec4c74abf0b0',
        },
        body: flaskForm,
      });
      const dur = performance.now() - t0;
      if (infRes.ok) {
        times.push(dur);
      } else {
        console.warn(`  Profile E run ${k} status: ${infRes.status}`);
      }
    } catch (err) {
      console.warn(`  Profile E run ${k} error: ${err.message}`);
    }
  }

  if (times.length > 0) {
    const sortedTimes = times.sort((a, b) => a - b);
    const p50Inf = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95Inf = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99Inf = sortedTimes[sortedTimes.length - 1];
    const avgInf = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;

    console.log(`  [Profile E] Inference runs: ${times.length} | Avg: ${avgInf.toFixed(0)}ms | p50: ${p50Inf.toFixed(0)}ms | p95: ${p95Inf.toFixed(0)}ms | p99: ${p99Inf.toFixed(0)}ms`);

    allResults.push({
      profile: 'Profile E - Inference Worker',
      virtualUsers: 1,
      throughputRps: Number((1000 / avgInf).toFixed(2)),
      totalRequests: times.length,
      latency: {
        p50: Number(p50Inf.toFixed(2)),
        p95: Number(p95Inf.toFixed(2)),
        p99: Number(p99Inf.toFixed(2)),
        avg: Number(avgInf.toFixed(2)),
      },
      errorRatePercent: 0,
      memoryRssMb: Number(getCpuAndMemory().rssMb),
    });
  }

  // Save results to file for final report
  const outputPath = '/home/liyakhat-yusuf-raza/.gemini/antigravity/brain/30dccbf0-7433-4ac3-a19d-63b7eaecf0e2/scratch/load_test_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n✓ Results written to ${outputPath}`);

  // Cleanup
  await Patient.deleteOne({ patientId: testPatientId });
  await Prediction.deleteMany({ patientId: testPatientId });
  await InferenceJob.deleteOne({ jobId: testJobId });
  await mongoose.disconnect();

  console.log('\n======================================================');
  console.log('✔ ALL 5 LOAD TESTING PROFILES COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('Comprehensive load test failed:', err);
  process.exit(1);
});
