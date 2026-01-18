const express = require('express');
const router = express.Router();
let multer;
try {
  multer = require('multer');
} catch (e) {
  multer = null;
  console.warn('Optional dependency "multer" not installed - file upload endpoint /api/cookies will be disabled. Install with: npm install multer');
}
const path = require('path');
const fs = require('fs');
const Cookie = require('../models/Cookie');
const { authenticateToken } = require('./_auth_helper');

// Directory to store cookie files
const COOKIE_DIR = process.env.COOKIE_DIR || path.join(__dirname, '..', '..', 'cookies');
if (!fs.existsSync(COOKIE_DIR)) fs.mkdirSync(COOKIE_DIR, { recursive: true, mode: 0o700 });

if (multer) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, COOKIE_DIR);
    },
    filename: function (req, file, cb) {
      // keep original filename
      cb(null, file.originalname);
    }
  });
  const upload = multer({ storage });

  // Upload a new cookie file (admin)
  router.post('/', authenticateToken, upload.single('cookie'), async (req, res) => {
    try {
      // TODO: Add admin check
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No cookie file provided' });

      const filePath = path.join(COOKIE_DIR, file.filename);
      // ensure secure perms
      try { fs.chmodSync(filePath, 0o600); } catch (e) { }

      const cookieDoc = new Cookie({ filename: file.filename, path: filePath, status: 'ready' });
      await cookieDoc.save();
      res.json({ success: true, cookie: cookieDoc });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
} else {
  // Fallback: upload endpoint is disabled when multer is not installed
  router.post('/', authenticateToken, async (req, res) => {
    res.status(501).json({ error: 'File upload endpoint disabled on server (dependency "multer" not installed). Install with: npm install multer' });
  });
}

// List cookies
router.get('/', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin check
    const cookies = await Cookie.find().lean();
    res.json({ cookies });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Register an existing cookie file already placed in COOKIE_DIR
router.post('/register', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin check
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const filePath = path.join(COOKIE_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found in COOKIE_DIR' });

    // secure permissions
    try { fs.chmodSync(filePath, 0o600); } catch (e) { }

    const existing = await Cookie.findOne({ filename });
    if (existing) return res.status(409).json({ error: 'Cookie with this filename already registered', cookie: existing });

    const cookieDoc = new Cookie({ filename, path: filePath, status: 'ready' });
    await cookieDoc.save();
    res.json({ success: true, cookie: cookieDoc });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Disable cookie
router.post('/:id/disable', authenticateToken, async (req, res) => {
  try {
    const cookie = await Cookie.findById(req.params.id);
    if (!cookie) return res.status(404).json({ error: 'Not found' });
    cookie.status = 'disabled';
    cookie.lastError = req.body.reason || 'disabled by admin';
    await cookie.save();
    res.json({ success: true, cookie });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Enable cookie
router.post('/:id/enable', authenticateToken, async (req, res) => {
  try {
    const cookie = await Cookie.findById(req.params.id);
    if (!cookie) return res.status(404).json({ error: 'Not found' });
    cookie.status = 'ready';
    cookie.lastError = null;
    await cookie.save();
    res.json({ success: true, cookie });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

module.exports = router;
