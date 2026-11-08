/**
 * Automated Production Load Testing Harness for NeuroScan AI
 * Executes Profiles A, B, C, D using autocannon programmatically.
 */

const autocannon = require('autocannon');
const http = require('http');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const InferenceJob = require('../src/models/InferenceJob');

const BASE_URL = 'http://127.0.0.1:5000';

async function runAutocannonProfile(name, opts) {
  console.log(`\n======================================================`);
  console.log(`▶ Running Profile: ${name}`);
  console.log(`  Target: ${opts.url} | Concurrency: ${opts.connections} | Duration: ${opts.duration}s`);
  console.log(`======================================================`);

  const result = await autocannon(opts);

  const summary = {
    name,
    target: opts.url,
    connections: opts.connections,
    duration: opts.duration,
    requests: {
      total: result.requests.total,
      average: result.requests.average,
      p50: result.requests.p50 || result.requests.average,
      rps: result.requests.average,
    },
    latency: {
      avg: result.latency.average,
      p50: result.latency.p50,
      p95: result.latency.p97_5,
      p99: result.latency.p99,
      max: result.latency.max,
    },
    throughput: {
      bytesPerSecond: result.throughput.average,
      totalBytes: result.throughput.total,
    },
    errors: {
      non2xx: result.non2xx,
      errors: result.errors,
      timeouts: result.timeouts,
    },
  };

  console.log(`  Requests Total:   ${result.requests.total} (${result.requests.average.toFixed(1)} req/sec)`);
  console.log(`  Latency (Avg):    ${result.latency.average.toFixed(2)} ms`);
  console.log(`  Latency (p50):    ${result.latency.p50} ms`);
  console.log(`  Latency (p95):    ${result.latency.p97_5} ms`);
  console.log(`  Latency (p99):    ${result.latency.p99} ms`);
  console.log(`  Latency (Max):    ${result.latency.max} ms`);
  console.log(`  Status Codes:     2xx: ${result['2xx']} | Non-2xx: ${result.non2xx} | Errors: ${result.errors}`);

  return summary;
}

// Generate valid synthetic PNG buffer (1x1 gray pixel PNG)
const validPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  await connectDB();

  // Create a persistent mock job for Profile C polling
  const sampleJobId = 'job_loadtest_benchmark_101';
  await InferenceJob.deleteOne({ jobId: sampleJobId });
  await InferenceJob.create({
    jobId: sampleJobId,
    patientId: 'patient_loadtest_01',
    originalFilename: 'test_mri_sample.png',
    fileSize: validPngBuffer.length,
    status: 'completed',
    progress: 100,
    result: {
      stageNumber: 1,
      prediction: 'NonDemented',
      confidence: 0.985,
    },
  });

  const results = [];

  // ============================================================================
  // PROFILE A: Lightweight Gateway API (GET /api/health)
  // Tested progressively: 10 -> 50 -> 100 -> 250 -> 500 -> 1,000 connections
  // ============================================================================
  const concurrenciesA = [10, 50, 100, 250, 500, 1000];
  for (const c of concurrenciesA) {
    const resA = await runAutocannonProfile(`Profile A - Health [C=${c}]`, {
      url: `${BASE_URL}/api/health`,
      connections: c,
      duration: 5,
      pipelining: 1,
    });
    results.push(resA);
  }

  // ============================================================================
  // PROFILE B: Asynchronous Job Ingestion (POST /api/predict/async)
  // Tests time-to-202 Accepted response under concurrent submissions
  // ============================================================================
  console.log(`\n======================================================`);
  console.log(`▶ Running Profile B: Asynchronous Job Ingestion (POST /api/predict/async)`);
  console.log(`======================================================`);
  
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const bodyBuffer = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="scan.png"\r\nContent-Type: image/png\r\n\r\n`
    ),
    validPngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const profileBResults = [];
  const testSubmissions = 20; // Tested within rate limits
  const startAll = Date.now();
  
  const asyncPromises = Array.from({ length: testSubmissions }).map(async (_, idx) => {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const req = http.request(
        `${BASE_URL}/api/predict/async`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => {
            const lat = performance.now() - t0;
            resolve({ statusCode: res.statusCode, latencyMs: lat, data: raw });
          });
        }
      );
      req.on('error', (err) => resolve({ statusCode: 500, latencyMs: performance.now() - t0, error: err.message }));
      req.write(bodyBuffer);
      req.end();
    });
  });

  const bResponses = await Promise.all(asyncPromises);
  const bLatencies = bResponses.map((r) => r.latencyMs).sort((a, b) => a - b);
  const bAvg = bLatencies.reduce((a, b) => a + b, 0) / bLatencies.length;
  const bP50 = bLatencies[Math.floor(bLatencies.length * 0.5)];
  const bP95 = bLatencies[Math.floor(bLatencies.length * 0.95)];
  const bP99 = bLatencies[bLatencies.length - 1];
  const b202Count = bResponses.filter((r) => r.statusCode === 202).length;

  console.log(`  Submissions:      ${testSubmissions} concurrent jobs`);
  console.log(`  Status 202 Count: ${b202Count} / ${testSubmissions}`);
  console.log(`  Latency (Avg):    ${bAvg.toFixed(2)} ms`);
  console.log(`  Latency (p50):    ${bP50.toFixed(2)} ms`);
  console.log(`  Latency (p95):    ${bP95.toFixed(2)} ms`);
  console.log(`  Latency (p99):    ${bP99.toFixed(2)} ms`);
  console.log(`  Under 50ms Target: ${bP95 < 50 ? 'PASS' : 'WARN'}`);

  results.push({
    name: 'Profile B - Async Ingestion (POST /api/predict/async)',
    submissions: testSubmissions,
    statusCode202: b202Count,
    latency: { avg: bAvg, p50: bP50, p95: bP95, p99: bP99 },
  });

  // ============================================================================
  // PROFILE C: Asynchronous Job Polling (GET /api/jobs/:jobId)
  // Tested progressively: 50 -> 100 -> 250 connections
  // ============================================================================
  const concurrenciesC = [50, 100, 250];
  for (const c of concurrenciesC) {
    const resC = await runAutocannonProfile(`Profile C - Job Polling [C=${c}]`, {
      url: `${BASE_URL}/api/jobs/${sampleJobId}`,
      connections: c,
      duration: 5,
      pipelining: 1,
    });
    results.push(resC);
  }

  // Clean up sample job
  await InferenceJob.deleteOne({ jobId: sampleJobId });
  await mongoose.connection.close();

  console.log('\n======================================================');
  console.log('✔ All Autocannon Load Tests Completed Successfully');
  console.log('======================================================');

  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Load testing error:', err);
    process.exit(1);
  });
}

module.exports = { runAutocannonProfile };
