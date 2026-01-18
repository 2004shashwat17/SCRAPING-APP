require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());

// Debug: log all requests and their bodies
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', req.body);
  }
  next();
});

const PORT = process.env.PORT || 5000;
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
  res.send('API is running');
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// OAuth routes
const oauthRoutes = require('./routes/oauth');
app.use('/api/oauth', oauthRoutes);

// Scraper routes
const scraperRoutes = require('./routes/scraper');
app.use('/api/scraper', scraperRoutes);

// Cookie admin routes
try {
  const cookieRoutes = require('./routes/cookies');
  app.use('/api/cookies', cookieRoutes);
} catch (e) {
  console.error('Failed to mount cookie routes:', e && e.message);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
