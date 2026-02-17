require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const cors = require('cors');


const app = express();
// Enable WebSocket routes (used for proxying DevTools to a running Chromium instance)
try {
  require('express-ws')(app);
} catch (e) {
  console.warn('express-ws failed to initialize (WS routes may not work):', e && e.message);
}

// --- Ensure minimal manual CORS/preflight handling (fallback) ---
// This guarantees we always respond to OPTIONS preflight with the appropriate
// headers even if other middleware or route mounting fails.
app.use((req, res, next) => {
  const frontendOrigin = process.env.FRONTEND_URL || process.env.FRONTEND || req.headers.origin || '*';
  const origin = frontendOrigin === '*' ? '*' : frontendOrigin;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Also enable the standard CORS middleware (configured similarly)
const frontendOrigin = process.env.FRONTEND_URL || process.env.FRONTEND || '*';
const corsOptions = {
  origin: frontendOrigin === '*' ? true : frontendOrigin,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(require('cors')(corsOptions));
app.use(express.json());

// Global process-level error handlers (log uncaught exceptions / rejections)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && (err.stack || err.message || err));
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason && (reason.stack || reason));
});

// Debug: log all requests and their bodies
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not set. The server will start but DB-backed features (jobs, cookies) will be disabled until you set MONGODB_URI.');
} else {
  mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('MongoDB connected');

      // Start job worker to process queued jobs
      try {
        const jobWorker = require('./workers/jobWorker');
        jobWorker.start();
      } catch (e) {
        console.error('Failed to start job worker:', e.message || e);
      }
    })
    .catch((err) => console.error('MongoDB connection error:', err));
}

// Routes
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Lightweight debug endpoint to verify the process / environment at runtime
app.get('/api/debug/status', (req, res) => {
  res.json({
    status: 'ok',
    pid: process.pid,
    uptime: process.uptime(),
    envPort: process.env.PORT || null,
    nodeVersion: process.version,
  });
});

// Auth routes
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
} catch (e) {
  console.error('Failed to mount auth routes:', e && e.message);
}

// OAuth routes
try {
  const oauthRoutes = require('./routes/oauth');
  app.use('/api/oauth', oauthRoutes);
} catch (e) {
  console.error('Failed to mount oauth routes:', e && e.message);
}

// Scraper routes
try {
  const scraperRoutes = require('./routes/scraper');
  app.use('/api/scraper', scraperRoutes);
} catch (e) {
  console.error('Failed to mount scraper routes:', e && e.message);
}

// Scraper webhook routes (ML integration)
try {
  const scraperWebhookRoutes = require('./routes/scraperWebhookRoutes');
  app.use(scraperWebhookRoutes);
  console.log('✅ Scraper webhook routes mounted');
} catch (e) {
  console.error('Failed to mount scraper webhook routes:', e && e.message);
}

// Cookie admin routes
try {
  const cookieRoutes = require('./routes/cookies');
  app.use('/api/cookies', cookieRoutes);
} catch (e) {
  console.error('Failed to mount cookie routes:', e && e.message);
}

// Facebook cookie capture (Puppeteer)
try {
  const fbCapture = require('./routes/facebookCapture');
  app.use('/api/facebook', fbCapture);
} catch (e) {
  console.error('Failed to mount facebook capture routes:', e && e.message);
}

// Note: job worker will be started after successful MongoDB connection above.

// Geocode routes (server-side geocoding and caching)
const geocodeRoutes = require('./routes/geocode');
app.use('/api/geocode', geocodeRoutes);

// Consent routes
const consentRoutes = require('./routes/consent');
app.use('/api/consent', consentRoutes);

// EDA routes removed (feature reverted)

// TODO: Add posts, dashboard, settings routes

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on ${PORT}`);
  console.log('process.env.PORT:', process.env.PORT);
});
