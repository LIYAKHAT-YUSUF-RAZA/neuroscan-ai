const express = require('express');
const cors = require('cors');
const { port, host, clientOrigin } = require('./config/env');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Parse comma-separated or single client origins
const allowedOrigins = clientOrigin
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Explicit list of allowed headers, including custom multi-patient, scheduler, and AI headers
// Both standard PascalCase and lowercase variations are included to handle client/browser preflights
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-AI-Secret-Key',
  'X-Target-Patient-Id',
  'X-Scheduler-Secret',
  'X-Patient-Id',
  'X-Timezone',
  'Accept',
  'content-type',
  'authorization',
  'x-ai-secret-key',
  'x-target-patient-id',
  'x-scheduler-secret',
  'x-patient-id',
  'x-timezone',
  'accept',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, Render health checks)
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(normalizedOrigin) ||
      normalizedOrigin.startsWith('http://localhost:') ||
      normalizedOrigin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders,
  optionsSuccessStatus: 204,
};

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Security headers with Helmet (disabling CSP to allow data URI heatmaps and client assets safely)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Gzip / Brotli response compression
app.use(compression());

// General API rate limiter (protecting server against DoS while keeping health endpoints clear)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 2000, // Generous ceiling for API endpoints; specific limits applied to heavy endpoints
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { success: false, error: 'Too many requests. Please slow down and try again later.' },
});
app.use('/api', generalLimiter);

// CORS configuration: allow frontend client and handle preflight OPTIONS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root health alias for convenience
app.get('/health', (req, res) => {
  res.redirect('/api/health');
});

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route '${req.originalUrl}' not found.` });
});

// Centralized Error Middleware
app.use(errorHandler);

const { startNotificationScheduler, stopNotificationScheduler } = require('./services/notificationScheduler');

let runningServer = null;

const shutdown = async (signal) => {
  console.log(`[Express Backend] Received ${signal}. Starting graceful shutdown...`);
  try {
    stopNotificationScheduler();
  } catch (err) {
    console.error('[Express Backend] Error stopping scheduler:', err);
  }

  if (runningServer) {
    runningServer.close(async () => {
      console.log('[Express Backend] HTTP server closed.');
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
          console.log('[Express Backend] MongoDB connection closed cleanly.');
        }
      } catch (err) {
        console.error('[Express Backend] Error closing MongoDB:', err);
      }
      process.exit(0);
    });

    // Force close after 10s if connections refuse to terminate
    setTimeout(() => {
      console.error('[Express Backend] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const { recoverStuckJobs } = require('./controllers/jobController');

const startServer = async () => {
  // Connect DB (non-blocking for startup)
  await connectDB();

  // Reconcile and recover any jobs orphaned by a process crash / restart
  await recoverStuckJobs();

  // Start in-process 60s notification scheduler ticker
  startNotificationScheduler();

  const server = app.listen(port, host, () => {
    console.log(`[Express Backend] Server running on http://${host}:${port}`);
    console.log(`[Express Backend] Allowed CORS client origins: ${allowedOrigins.join(', ')}`);
  });

  runningServer = server;
  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, shutdown };
