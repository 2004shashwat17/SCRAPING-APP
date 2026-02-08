const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { encryptJSON } = require('../utils/cryptoCookies');
const { saveCookieToCloud, isCloudStorageEnabled } = require('../utils/cookieStorage');
const mongoose = require('mongoose');
const { authenticateToken } = require('./_auth_helper');
const User = require('../models/User');
const { execSync } = require('child_process');

const router = express.Router();

// Tracks saved sessions for reference
const savedSessions = new Map();
// Cookie storage directory - can be overridden with COOKIE_DIR env var for cloud/volume storage
const COOKIES_DIR = process.env.COOKIE_DIR || path.join(__dirname, '..', '..', 'cookies');

if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

// Save cookies only if they include the required session cookies (c_user & xs),
// unless `force` is true. Returns { saved: boolean, filepath?: string }
async function saveCookiesSafely(sessionId, userId, cookies = [], force = false) {
  try {
    const names = (cookies || []).map(c => c.name);
    const hasFull = names.includes('c_user') && names.includes('xs');
    if (!hasFull && !force) {
      console.log(`facebookCapture: session=${sessionId} not saved — missing c_user/xs — saw: ${names.join(',')}`);
      return { saved: false };
    }
    
    // Get username from DB to use as filename
    let username = userId; // fallback to userId if username not found
    try {
      const user = await User.findById(userId).select('username').lean();
      if (user && user.username) {
        username = user.username;
      }
    } catch (err) {
      console.warn('Failed to fetch username, using userId as filename:', err.message);
    }
    
    // Use username_latest.json format (always overwrites with latest version)
    const filename = `${username}_latest.json`;
    let filepath;
    
    // Check if cloud storage (Cloudflare R2) is enabled
    if (isCloudStorageEnabled()) {
      try {
        // Save to Cloudflare R2 (handles both .json and .pkl if SAVE_PLAINTEXT_COOKIES=true)
        filepath = await saveCookieToCloud(filename, cookies || []);
        console.log(`✅ Saved cookies to Cloudflare R2: ${filepath}`);
      } catch (cloudErr) {
        console.error('Failed to save to R2, falling back to local storage:', cloudErr.message);
        // Fallback to local storage if R2 fails
        filepath = path.join(COOKIES_DIR, filename);
        try { fs.writeFileSync(filepath, JSON.stringify(cookies || [], null, 2), { encoding: 'utf8', mode: 0o600 }); } catch (e) { console.error('Failed to write cookie file:', e); }
      }
    } else {
      // Local filesystem storage (original behavior)
      filepath = path.join(COOKIES_DIR, filename);
      try { fs.writeFileSync(filepath, JSON.stringify(cookies || [], null, 2), { encoding: 'utf8', mode: 0o600 }); } catch (e) { console.error('Failed to write cookie file:', e); }
      
      // If SAVE_PLAINTEXT_COOKIES is enabled, also write .pkl (Python pickle) for direct inspection
      if (process.env.SAVE_PLAINTEXT_COOKIES === 'true') {
        try {
          const pklFilepath = filepath.replace(/\.json$/, '.pkl');
          // Write pickle using Python3 (ensure it's installed on the system)
          const pythonCmd = `python3 -c "import json,pickle,sys; pickle.dump(json.load(open('${filepath}')), open('${pklFilepath}','wb'))"`;
          execSync(pythonCmd, { stdio: 'ignore' });
          fs.chmodSync(pklFilepath, 0o600);
          console.log(`saveCookiesSafely: wrote plaintext .pkl to ${pklFilepath}`);
        } catch (pklErr) {
          console.warn('Failed to write .pkl file (is python3 installed?):', pklErr && pklErr.message ? pklErr.message : pklErr);
        }
      }
    }
    
    // Save session metadata locally (small file, fast lookup)
    try { fs.writeFileSync(path.join(COOKIES_DIR, `session_${sessionId}.json`), JSON.stringify({ filepath, userId, savedAt: Date.now() }), { encoding: 'utf8', mode: 0o600 }); } catch (e) { /* ignore */ }
    
    savedSessions.set(sessionId, { filepath, userId, savedAt: Date.now() });
    let encrypted; try { encrypted = encryptJSON(cookies || []); } catch (e) { console.error('encrypt failed', e); }
    
    // Update DB with encrypted cookies and filepath
    if (process.env.MONGODB_URI && mongoose.connection.readyState === 1) {
      try { await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath }); } catch (dbErr) { console.error('Failed to update user in DB (saveCookiesSafely metadata):', dbErr && dbErr.message ? dbErr.message : dbErr); }
    }
    return { saved: true, filepath };
  } catch (e) {
    console.error('saveCookiesSafely error', e && e.message ? e.message : e);
    return { saved: false };
  }
}

// POST /api/facebook/upload-cookies
// Accepts cookies from the user's browser (array or raw string) and saves them using saveCookiesSafely.
router.post('/upload-cookies', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(400).json({ error: 'Missing user context' });
    let { cookies, cookieString } = req.body || {};

    // If a cookieString was provided (document.cookie style or JSON text), try to parse it
    if (!cookies && cookieString) {
      // Try JSON first
      try {
        const parsed = JSON.parse(cookieString);
        if (Array.isArray(parsed)) cookies = parsed;
      } catch (e) {
        // Not JSON — try simple name=value; parsing
        const parts = cookieString.split(';').map(s => s.trim()).filter(Boolean);
        cookies = parts.map(p => {
          const eq = p.indexOf('=');
          if (eq === -1) return null;
          return { name: p.slice(0, eq).trim(), value: p.slice(eq + 1).trim(), domain: '.facebook.com', path: '/' };
        }).filter(Boolean);
      }
    }

    if (!Array.isArray(cookies) || cookies.length === 0) return res.status(400).json({ error: 'No cookies provided' });

    // normalize cookie objects to shape expected by saveCookiesSafely
    const normalized = cookies.map((c) => {
      if (!c) return null;
      return {
        name: c.name || c.key || c.N || '',
        value: c.value || c.v || c.V || '',
        domain: c.domain || c.Domain || '.facebook.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.expiry || c.expirationDate || undefined,
        expiry: c.expiry || c.expires || c.expirationDate || undefined, 
        httpOnly: c.httpOnly !== undefined ? c.httpOnly : (c.http_only !== undefined ? c.http_only : false),
        secure: c.secure !== undefined ? c.secure : false,
        sameSite: c.sameSite || c.SameSite || undefined,
      };
    }).filter(Boolean);

    const names = normalized.map(c => c.name);
    const hasSession = names.includes('c_user') && names.includes('xs');
    if (!hasSession) {
      return res.status(400).json({ status: 'no_session', message: 'Required session cookies (c_user & xs) not present', seen: names });
    }

    // create a sessionId for record keeping
    const sessionId = uuidv4();
    const saved = await saveCookiesSafely(sessionId, userId, normalized, false);
    if (!saved || !saved.saved) return res.status(500).json({ error: 'Failed to save cookies' });

    // Mark the user connected in DB
    try {
      await User.findByIdAndUpdate(userId, { facebookConnected: true, facebookConnectedAt: Date.now() });
    } catch (e) {
      console.warn('upload-cookies: failed to mark user connected', e && e.message ? e.message : e);
    }

    // Do not return filepaths or cookie contents — only acknowledge success and sessionId.
    return res.json({ status: 'ok', message: 'Cookies saved and encrypted', sessionId });
  } catch (err) {
    console.error('upload-cookies error', err && (err.stack || err.message || err));
    return res.status(500).json({ error: 'Failed to upload cookies', details: err && (err.message || String(err)) });
  }
});

module.exports = router;
