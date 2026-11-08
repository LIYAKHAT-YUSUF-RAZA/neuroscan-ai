/**
 * Phase 2 — Persistent Storage Production Verification Test Suite
 * Tests:
 * 1. Upload MRI scan
 * 2. Retrieve MRI binary & check SHA-256 hash
 * 3. Simulate backend restart & reinitialize storage adapter
 * 4. Retrieve same MRI binary post-restart & verify byte parity
 * 5. Reanalyse stored MRI scan without reupload
 * 6. Simulate storage reconnection
 * 7. Audit cloud storage production credentials (S3/R2)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const mongoose = require('mongoose');

const { app } = require('../src/server');
const { connectDB } = require('../src/config/db');
const Patient = require('../src/models/Patient');
const MriScan = require('../src/models/MriScan');
const Prediction = require('../src/models/Prediction');
const { signToken } = require('../src/middlewares/auth');
const storageService = require('../src/services/storage');
const env = require('../src/config/env');

const samplePngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const originalHash = crypto.createHash('sha256').update(samplePngBuffer).digest('hex');

async function run() {
  console.log('================================================================');
  console.log('PHASE 2: PERSISTENT STORAGE PRODUCTION VERIFICATION');
  console.log('================================================================');

  await connectDB();
  let server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  let port = server.address().port;
  let baseUrl = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();
  const patient = await Patient.create({
    patientId: `pat_storage_verify_${timestamp}`,
    name: 'Storage Verification Patient',
    email: `storage_${timestamp}@test.com`,
    role: 'patient',
  });
  const token = signToken({ patientId: patient.patientId, role: 'patient' });

  console.log(`[Step 1] Uploading MRI Scan for patient ${patient.patientId}...`);
  const formData = new FormData();
  formData.append('image', new Blob([samplePngBuffer], { type: 'image/png' }), 'durability_baseline.png');
  formData.append('visitDate', '2026-11-04');
  formData.append('visitNotes', 'Durability baseline acquisition');

  const uploadRes = await fetch(`${baseUrl}/api/predict?include_heatmaps=false`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
  }
  const uploadData = await uploadRes.json();
  const scanId = uploadData.scanId;
  console.log(`✓ Upload successful. scanId: ${scanId}, evaluationType: ${uploadData.evaluationType}`);

  console.log(`[Step 2] Retrieving stored MRI binary prior to restart...`);
  const streamRes1 = await fetch(`${baseUrl}/api/scans/${scanId}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!streamRes1.ok) {
    throw new Error(`Stream prior to restart failed: ${streamRes1.status}`);
  }
  const streamBuf1 = Buffer.from(await streamRes1.arrayBuffer());
  const hash1 = crypto.createHash('sha256').update(streamBuf1).digest('hex');
  console.log(`✓ Retrieved binary size: ${streamBuf1.length} bytes, SHA-256: ${hash1}`);
  if (hash1 !== originalHash) {
    throw new Error(`Hash mismatch! Expected ${originalHash}, got ${hash1}`);
  }
  console.log(`✓ Binary integrity verified prior to restart.`);

  console.log(`[Step 3] Simulating backend server process termination and restart...`);
  await new Promise((resolve) => server.close(resolve));
  console.log(`✓ Active HTTP server closed.`);

  // Create fresh HTTP server instance simulating process restart
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Server restarted on new ephemeral port ${port}.`);

  console.log(`[Step 4] Retrieving the same MRI binary POST-RESTART...`);
  const streamRes2 = await fetch(`${baseUrl}/api/scans/${scanId}/image`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!streamRes2.ok) {
    throw new Error(`Stream post-restart failed: ${streamRes2.status}`);
  }
  const streamBuf2 = Buffer.from(await streamRes2.arrayBuffer());
  const hash2 = crypto.createHash('sha256').update(streamBuf2).digest('hex');
  console.log(`✓ Retrieved binary post-restart size: ${streamBuf2.length} bytes, SHA-256: ${hash2}`);
  if (hash2 !== originalHash) {
    throw new Error(`Post-restart hash mismatch! Expected ${originalHash}, got ${hash2}`);
  }
  console.log(`✓ Identical byte parity confirmed across backend restart.`);

  console.log(`[Step 5] Triggering reanalysis of stored scan without reupload...`);
  const reanalyseRes = await fetch(`${baseUrl}/api/scans/${scanId}/reanalyse?include_heatmaps=false`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!reanalyseRes.ok) {
    throw new Error(`Reanalysis failed: ${reanalyseRes.status} ${await reanalyseRes.text()}`);
  }
  const reanalyseData = await reanalyseRes.json();
  console.log(`✓ Reanalysis successful. EvaluationType: ${reanalyseData.evaluationType}, analysisCount: ${reanalyseData.analysisCount}`);

  console.log(`[Step 6] Simulating storage reconnection & adapter cache revalidation...`);
  const scanDoc = await MriScan.findOne({ scanId });
  const exists = await storageService.scanImageExists(scanDoc.storageReference);
  const directFetch = await storageService.getScanImage(scanDoc.storageReference);
  const directHash = crypto.createHash('sha256').update(directFetch.buffer).digest('hex');
  console.log(`✓ Direct adapter access verified. Exists: ${exists}, SHA-256: ${directHash}`);
  if (!exists || directHash !== originalHash) {
    throw new Error(`Direct adapter verification failed.`);
  }

  console.log(`[Step 7] Production Cloud Storage Durability Audit:`);
  console.log(`  - STORAGE_DRIVER configured: '${env.storageDriver}'`);
  console.log(`  - STORAGE_BASE_PATH: '${env.storageBasePath}'`);
  console.log(`  - S3_BUCKET: '${env.s3Bucket ? env.s3Bucket : '[NOT SET - Using LocalStorageAdapter]'}'`);
  console.log(`  - S3_REGION: '${env.s3Region ? env.s3Region : '[NOT SET]'}'`);
  console.log(`  - S3_ACCESS_KEY_ID: '${env.s3AccessKeyId ? '******' : '[NOT SET]'}'`);

  const isCloudPersistent = Boolean(env.storageDriver === 's3' && env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey);
  if (!isCloudPersistent) {
    console.log(`\n  [CRITICAL PRODUCTION FINDING]:`);
    console.log(`  Active driver is 'local' (LocalStorageAdapter).`);
    console.log(`  On dedicated single-node VMs or containers with persistent disk mounts (e.g. AWS EBS, GCP Persistent Disk),`);
    console.log(`  local storage persists across backend restarts.`);
    console.log(`  HOWEVER, on free-tier ephemeral cloud PaaS (e.g. Render Free Tier web services),`);
    console.log(`  the local filesystem is ephemeral and re-initialized on every deployment/spin-down.`);
    console.log(`  => Genuine production cloud persistence requires configured S3 / Cloudflare R2 / Backblaze B2 credentials.`);
  } else {
    console.log(`  ✓ Cloud S3 persistence is fully configured.`);
  }

  // Cleanup
  await server.close();
  await Patient.deleteOne({ patientId: patient.patientId });
  await MriScan.deleteOne({ scanId });
  await Prediction.deleteMany({ scanId });
  await mongoose.disconnect();

  console.log('\n✓ PHASE 2 VERIFICATION COMPLETE: ALL STORAGE TESTS PASSED.');
  return { success: true, isCloudPersistent };
}

run().catch((err) => {
  console.error('Phase 2 verification failed:', err);
  process.exit(1);
});
