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

// CORS configuration: allow frontend client
app.use(
  cors({
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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server
const startServer = async () => {
  // Connect DB (non-blocking for startup)
  await connectDB();

  const server = app.listen(port, host, () => {
    console.log(`[Express Backend] Server running on http://${host}:${port}`);
    console.log(`[Express Backend] Allowed CORS client origins: ${allowedOrigins.join(', ')}`);
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
