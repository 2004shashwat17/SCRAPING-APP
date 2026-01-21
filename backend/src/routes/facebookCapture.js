const express = require('express');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { encryptJSON } = require('../utils/cryptoCookies');
const mongoose = require('mongoose');
const { authenticateToken } = require('./_auth_helper');
const User = require('../models/User');

const router = express.Router();
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

const sessions = new Map();
// Tracks sessions whose cookies have been saved so frontend can detect success
// even after the Puppeteer session is closed.
const savedSessions = new Map();
const TIMEOUT = parseInt(process.env.COOKIE_CAPTURE_TIMEOUT_MS || '45000', 10);
// Maximum time to wait for a user to complete headful login/2FA/captcha (ms).
// Can be overridden with env `MAX_CAPTURE_WAIT_MS`. Default: 15 minutes.
const MAX_CAPTURE_WAIT_MS = parseInt(process.env.MAX_CAPTURE_WAIT_MS || String(15 * 60 * 1000), 10);
const COOKIES_DIR = path.join(__dirname, '..', '..', 'cookies');

if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

// Helper: wait for session cookies (c_user and xs) to appear, fallback to CDP
async function waitForSessionCookies(page, timeoutMs = Math.max(TIMEOUT, 30000), interval = 500) {
  const need = ['c_user', 'xs'];
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const cookies = await page.cookies();
      const names = cookies.map(c => c.name);
      const ok = need.every(n => names.includes(n));
      if (ok) return cookies;
    } catch (e) {
      // ignore and retry
    }
    await new Promise(r => setTimeout(r, interval));
  }

  // fallback to CDP getAllCookies
  try {
    const client = await page.target().createCDPSession();
    const all = await client.send('Network.getAllCookies');
    const names = (all.cookies || []).map(c => c.name);
    const ok = need.every(n => names.includes(n));
    if (ok) return all.cookies;
    return all.cookies; // return whatever we got
  } catch (e) {
    console.error('waitForSessionCookies CDP error', e);
    return [];
  }
}

// simple sleep helper
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Clean up a session: close browser, kill Xvfb if started, and remove from map
async function cleanupSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return;
  try {
    if (s.browser) {
      await s.browser.close();
    }
  } catch (e) {
    console.warn('cleanupSession: browser.close failed', e && (e.message || e));
  }
  try {
    if (s.xvfbProc) {
      try { s.xvfbProc.kill(); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.warn('cleanupSession: xvfb kill failed', e && (e.message || e));
  }
  sessions.delete(sessionId);
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
    const filename = `${userId}_${Date.now()}.json`;
    const filepath = path.join(COOKIES_DIR, filename);
    try { fs.writeFileSync(filepath, JSON.stringify(cookies || [], null, 2), { encoding: 'utf8', mode: 0o600 }); } catch (e) { console.error('Failed to write cookie file:', e); }
    try { fs.writeFileSync(path.join(COOKIES_DIR, `session_${sessionId}.json`), JSON.stringify({ filepath, userId, savedAt: Date.now() }), { encoding: 'utf8', mode: 0o600 }); } catch (e) { /* ignore */ }
    savedSessions.set(sessionId, { filepath, userId, savedAt: Date.now() });
    let encrypted; try { encrypted = encryptJSON(cookies || []); } catch (e) { console.error('encrypt failed', e); }
    // Do NOT automatically set `facebookConnected` here — callers should decide when to mark the
    // user as connected (e.g., after confirming a full c_user+xs session or after manual verification).
    // We still persist encrypted cookies and the cookie filepath; update the DB only if the caller
    // explicitly wants to mark the user connected.
    if (process.env.MONGODB_URI && mongoose.connection.readyState === 1) {
      try { await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath }); } catch (dbErr) { console.error('Failed to update user in DB (saveCookiesSafely metadata):', dbErr && dbErr.message ? dbErr.message : dbErr); }
    }
    return { saved: true, filepath };
  } catch (e) {
    console.error('saveCookiesSafely error', e && e.message ? e.message : e);
    return { saved: false };
  }
}

// Helper: try multiple selectors and return the first that exists
async function findSelector(page, selectors = [], timeout = 8000) {
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout });
      return sel;
    } catch (e) {
      // try next
    }
  }
  return null;
}

// Common selector lists (extendable)
const TWO_FA_SELECTORS = [
  'input[name="approvals_code"]',
  'input#approvals_code',
  'input[aria-label*="code"]',
  'input[placeholder*="Code"]',
  'input[type="tel"]',
];

// CAPTCHA selector hints (reCAPTCHA iframes, common captcha containers)
const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[title*="recaptcha"]',
  'div.g-recaptcha',
  '#captcha',
  '.captcha',
  'iframe[src*="hcaptcha"]',
  'div[data-testid="recaptcha"]'
];

const CHECKPOINT_BUTTON_SELECTORS = [
  '#checkpointSubmitButton',
  'button[name="submit[Continue]"]',
  'button[aria-label*="Continue"]',
  'div[role="button"] button',
];

// All facebook capture routes require an authenticated user
// Development-only helper routes: defined before auth middleware so they bypass JWT
if (process.env.NODE_ENV === 'development') {
  console.warn('facebookCapture: development-only routes enabled (dev-start, dev-submit-2fa)');

  // POST /api/facebook/dev-start
  router.post('/dev-start', async (req, res) => {
    let { userId, fbEmail, fbPassword } = req.body;
    // allow userId to be optional for dev: create anon id if missing
    if (!fbEmail || !fbPassword) return res.status(400).json({ error: 'Missing required fields: fbEmail and fbPassword are required' });
    if (!userId) {
      userId = `anon_${Date.now()}`;
      console.warn('dev-start: userId not provided, using', userId);
    }
    // Reuse the same logic as /start but bypass auth and use given userId
    try {
      const sessionId = uuidv4();
      // support headful dev mode when requested
      const headful = !!req.body.headful;
      const launchOpts = {
      headless: !headful,
      // Do not open DevTools automatically for headful sessions — user will interact
      // with the visible browser window. Keep slowMo 0 for responsiveness.
      devtools: false,
      slowMo: 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--window-size=1280,800']
    };
      const browser = await puppeteer.launch(launchOpts);
      const page = await browser.newPage();
      page.setDefaultTimeout(TIMEOUT);
      sessions.set(sessionId, { browser, page, createdAt: Date.now(), userId });
      await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

      // Robustly find email/password inputs (site markup may vary by locale/A/B test)
      const emailSel = await findSelector(page, ['#email', 'input[name="email"]', 'input[type="email"]'], 8000);
      if (!emailSel) {
        const snapName = `${userId}_${Date.now()}_no_email.png`;
        const htmlName = `${userId}_${Date.now()}_no_email.html`;
        try {
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save no_email debug artifacts', e); }
        await browser.close();
        sessions.delete(sessionId);
        return res.status(500).json({ error: 'Dev start failed', details: 'No element found for selectors: email input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
      }
      await page.type(emailSel, fbEmail, { delay: 50 });

      const passSel = await findSelector(page, ['#pass', 'input[name="pass"]', 'input[type="password"]'], 8000);
      if (!passSel) {
        const snapName = `${userId}_${Date.now()}_no_pass.png`;
        const htmlName = `${userId}_${Date.now()}_no_pass.html`;
        try {
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save no_pass debug artifacts', e); }
        await browser.close();
        sessions.delete(sessionId);
        return res.status(500).json({ error: 'Dev start failed', details: 'No element found for selectors: password input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
      }
      await page.type(passSel, fbPassword, { delay: 50 });

      const loginBtn = await page.$('button[name="login"], button[type="submit"], button#loginbutton');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        try { await page.click('button[name="login"]'); } catch (e) { /* ignore */ }
      }
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }),
          page.waitForSelector('input[name="approvals_code"]', { timeout: TIMEOUT }),
          page.waitForSelector('#checkpointSubmitButton', { timeout: TIMEOUT }),
        ]);
      } catch (e) {}

      // Use robust selector finding
      const devSel2fa = await findSelector(page, TWO_FA_SELECTORS, 1000);
      const devSelCheckpoint = await findSelector(page, CHECKPOINT_BUTTON_SELECTORS, 1000);
      if (devSel2fa || devSelCheckpoint) {
        return res.json({ status: '2fa_required', sessionId, message: 'Two-factor authentication required. Please enter the code shown on your device.', matched: { devSel2fa, devSelCheckpoint } });
      }

      const cookies = await page.cookies();
      const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
      if (!saved.saved) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'no_session', message: 'Session cookies (c_user & xs) not present after dev-start', cookies, retryAfterMs: 3000 });
      }
      const filepath = saved.filepath;
      let encrypted;
      try { encrypted = encryptJSON(cookies); } catch (e) { console.error('encrypt failed', e); }

      if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
      }

      try {
        // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
        await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
      } catch (dbErr) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
      }

      await browser.close();
      sessions.delete(sessionId);
      return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
    } catch (err) {
      console.error('dev-start error', err);
      return res.status(500).json({ error: 'Dev start failed', details: err.message });
    }
  });

  // POST /api/facebook/dev-submit-2fa
  router.post('/dev-submit-2fa', async (req, res) => {
    const { sessionId, code } = req.body;
    // optional post-2FA wait (ms) to allow site to set cookies; default to 30s
    let postWaitMs = parseInt(String(req.body && req.body.waitMs || ''), 10) || 30000;
    if (postWaitMs < 0) postWaitMs = 0;
    if (postWaitMs > 5 * 60 * 1000) postWaitMs = 5 * 60 * 1000; // cap 5 minutes
    if (!sessionId || !code) return res.status(400).json({ error: 'Missing required fields: sessionId and code are required' });
    const session = sessions.get(sessionId);
    if (!session) return res.status(410).json({ error: 'Session not found or expired' });
    const userId = session.userId || `anon_${Date.now()}`;
    const { page, browser } = session;
    try {
      // find a suitable input for the code and type into it (works for input or focusable element)
      const codeSel = await findSelector(page, TWO_FA_SELECTORS, 1500);
      if (!codeSel) return res.status(401).json({ status: 'failed', message: '2FA input not found; try again' });
      try {
        await page.focus(codeSel);
        await page.keyboard.type(code, { delay: 50 });
      } catch (e) {
        // fallback: try page.type
        try { await page.type(codeSel, code, { delay: 50 }); } catch (ee) { console.warn('typing into 2FA field failed', ee); }
      }
      const btnSel = await findSelector(page, CHECKPOINT_BUTTON_SELECTORS, 1500);
      await sessions.delete(sessionId);
      if (captchaSel) {
        // user must complete captcha in UI
        try {
          const snapName = `${userId}_${Date.now()}_captcha_after_code.png`;
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          const htmlName = `${userId}_${Date.now()}_captcha_after_code.html`;
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save captcha debug artifacts after code', e); }
        return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected after code submission; please solve it in the browser.' });
      }
      if (btnSel) {
        try { await page.click(btnSel); } catch (e) { console.warn('clicking checkpoint button failed', e); }
      }
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }).catch(() => {});
      if (page.url().includes('login') || page.url().includes('checkpoint')) {
        return res.status(401).json({ status: 'failed', message: '2FA code not accepted; try again' });
      }

      // wait for the configured period to let the site set cookies after 2FA
      await sleep(postWaitMs);
      // if a captcha appears during this wait, return captcha_required
      const captchaSel2 = await findSelector(page, CAPTCHA_SELECTORS, 1000);
      if (captchaSel2) {
        try {
          const snapName = `${userId}_${Date.now()}_captcha_after_wait.png`;
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          const htmlName = `${userId}_${Date.now()}_captcha_after_wait.html`;
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save captcha debug artifacts after wait', e); }
        return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected after waiting for post-2FA; please solve it in the browser.' });
      }
      const cookies = await waitForSessionCookies(page, Math.max(10000, postWaitMs + 10000));
      const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
      if (!saved.saved) return res.json({ status: 'no_session', message: 'Session cookies not present after 2FA wait', cookies, retryAfterMs: 3000 });
      const filepath = saved.filepath;
      let encrypted;
      try { encrypted = encryptJSON(cookies); } catch (e) { console.error('encrypt failed', e); }

      if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
      }

      try {
        // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
        await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
      } catch (dbErr) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
      }

      await browser.close();
      sessions.delete(sessionId);
      return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
    } catch (err) {
      console.error('dev-submit-2fa error', err);
      await cleanupSession(sessionId);
      return res.status(500).json({ error: 'Dev submit 2FA failed', details: err.message });
    }
  });

  // POST /api/facebook/dev-check-session
  // Checks an existing dev session for session cookies (c_user/xs) and saves them if present.
  router.post('/dev-check-session', async (req, res) => {
    const { sessionId } = req.body || {};
    // optional wait time in ms (for headful flows where user completes 2FA in browser)
    let waitMs = parseInt(String(req.body && req.body.waitMs || ''), 10) || 0;
    // cap to 10 minutes (allow longer headful waits for manual solve)
    if (waitMs > 10 * 60 * 1000) waitMs = 10 * 60 * 1000;
    // optional post-detection wait (ms) to allow cookies to settle after detecting session; default 10s
    let postDetectWaitMs = parseInt(String(req.body && req.body.postDetectWaitMs || ''), 10);
    if (Number.isNaN(postDetectWaitMs)) postDetectWaitMs = 10000;
    if (postDetectWaitMs < 0) postDetectWaitMs = 0;
    if (postDetectWaitMs > 60 * 1000) postDetectWaitMs = 60 * 1000; // cap 60s
    // optional post-captcha wait (ms) to allow time after captcha is solved; default 10s
    let postCaptchaWaitMs = parseInt(String(req.body && req.body.postCaptchaWaitMs || ''), 10);
    if (Number.isNaN(postCaptchaWaitMs)) postCaptchaWaitMs = 10000;
    if (postCaptchaWaitMs < 0) postCaptchaWaitMs = 0;
    if (postCaptchaWaitMs > 5 * 60 * 1000) postCaptchaWaitMs = 5 * 60 * 1000; // cap 5 minutes
    if (!sessionId) return res.status(400).json({ error: 'Missing required field: sessionId' });
    const session = sessions.get(sessionId);
    if (!session) return res.status(410).json({ error: 'Session not found or expired' });
    const userId = session.userId || `anon_${Date.now()}`;
    const { page, browser } = session;
    try {
      // If waitMs supplied, block up to that time waiting for session cookies, otherwise do a quick check
      const checkTimeout = waitMs && waitMs > 0 ? waitMs : 1000;
      const cookies = await waitForSessionCookies(page, checkTimeout);
      const names = (cookies || []).map(c => c.name);
      const hasSession = names.includes('c_user') && names.includes('xs');
      // if a captcha is present, either return captcha_required or wait for the postCaptchaWaitMs
      const captchaSel = await findSelector(page, CAPTCHA_SELECTORS, 1000);
      if (captchaSel) {
        if (postCaptchaWaitMs > 0) {
          await sleep(postCaptchaWaitMs);
          const cookiesAfter = await waitForSessionCookies(page, Math.min(postCaptchaWaitMs + 5000, 60000));
          const namesAfter = (cookiesAfter || []).map(c => c.name);
          const hasSessionAfter = namesAfter.includes('c_user') && namesAfter.includes('xs');
          if (!hasSessionAfter) {
            try {
              const snapName = `${userId}_${Date.now()}_captcha_waited.png`;
              const htmlName = `${userId}_${Date.now()}_captcha_waited.html`;
              await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
              await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
            } catch (e) { console.warn('failed to save captcha_waited debug artifacts', e); }
            return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA present; solved but no session cookies yet', debug: {} });
          }
          // replace cookies and proceed
          cookies.splice(0, cookies.length, ...(cookiesAfter || []));
        } else {
          return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected. Please solve it in the opened browser window.' });
        }
      }

      if (hasSession && postDetectWaitMs > 0) {
        // Give the site a short grace period to settle cookies (handle async JS or redirects)
        await sleep(postDetectWaitMs);
        // re-check cookies quickly
        const cookies2 = await page.cookies().catch(() => []);
        const names2 = (cookies2 || []).map(c => c.name);
        if (!names2.includes('c_user') || !names2.includes('xs')) {
          console.warn('session cookies disappeared after postDetect wait; names before:', names, 'after:', names2);
          return res.json({ status: 'no_session', message: 'Session cookies not present after post-detect wait', cookies: cookies2 || [], retryAfterMs: 3000 });
        }
        // replace cookies with latest
        cookies.splice(0, cookies.length, ...(cookies2 || []));
      }
      if (!hasSession) {
        // Save debug artifacts to help investigation
        try {
          const snapName = `${userId}_${Date.now()}_no_session_check.png`;
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          const htmlName = `${userId}_${Date.now()}_no_session_check.html`;
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save no_session_check debug artifacts', e); }
        return res.json({ status: 'no_session', message: 'No session cookies present yet', cookies: cookies || [], debug: { screenshot: null }, retryAfterMs: 3000 });
      }

      const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
      if (!saved.saved) {
        await cleanupSession(sessionId);
        return res.json({ status: 'no_session', message: 'Session cookies not present', cookies, retryAfterMs: 3000 });
      }
      const filepath = saved.filepath;

      // encryption handled inside saveCookiesSafely already

      if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
        await cleanupSession(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
      }

      try {
        // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
        await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
      } catch (dbErr) {
        try { await browser.close(); } catch (_) {}
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
      }

      await cleanupSession(sessionId);
      return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
    } catch (err) {
      console.error('dev-check-session error', err);
      try { await browser.close(); } catch (_) {}
      sessions.delete(sessionId);
      return res.status(500).json({ error: 'Dev check session failed', details: err.message });
    }
  });
}

// All facebook capture routes require an authenticated user
router.use(authenticateToken);

// POST /api/facebook/start
router.post('/start', async (req, res) => {
  const userId = req.userId;
  const { fbEmail, fbPassword } = req.body;
  if (!userId || !fbEmail || !fbPassword) return res.status(400).json({ error: 'Missing required fields' });

  const sessionId = uuidv4();
  // Client may request we wait for a full session (c_user & xs) before saving/closing.
  // Default: true (wait for full login/2FA). If false, we'll save on profile detection.
  const waitForFullSession = !(req.body && req.body.waitForFullSession === false);
  console.log(`facebookCapture: open-headful requested session=${sessionId} user=${userId} waitForFullSession=${waitForFullSession}`);
  let browser;
  try {
    const headful = !!req.body.headful;
    const launchOpts = {
      headless: !headful,
      // Keep DevTools closed for user-facing headful sessions and keep interactions responsive
      devtools: false,
      slowMo: 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--window-size=1280,800']
    };
    // If an external Chrome/Chromium is available (or you prefer puppeteer-core), set PUPPETEER_EXECUTABLE_PATH
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    // Attach Xvfb process handle if one was started (so watcher can clean up)
    const sessionXvfb = typeof xvfb !== 'undefined' ? xvfb : null;
    sessions.set(sessionId, { browser, page, createdAt: Date.now(), userId, xvfbProc: sessionXvfb });

    sessions.set(sessionId, { browser, page, createdAt: Date.now(), userId });

    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

    const emailSel = await findSelector(page, ['#email', 'input[name="email"]', 'input[type="email"]'], 8000);
    if (!emailSel) {
      const snapName = `${userId}_${Date.now()}_no_email.png`;
      const htmlName = `${userId}_${Date.now()}_no_email.html`;
      try {
        await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
        await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
      } catch (e) { console.warn('failed to save no_email debug artifacts', e); }
      await cleanupSession(sessionId);
      return res.status(500).json({ error: 'No element found for selector: #email', details: 'Login page did not show an email input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
    }
    await page.type(emailSel, fbEmail, { delay: 50 });

    const passSel = await findSelector(page, ['#pass', 'input[name="pass"]', 'input[type="password"]'], 8000);
    if (!passSel) {
      const snapName = `${userId}_${Date.now()}_no_pass.png`;
      const htmlName = `${userId}_${Date.now()}_no_pass.html`;
      try {
        await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
        await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
      } catch (e) { console.warn('failed to save no_pass debug artifacts', e); }
      await cleanupSession(sessionId);
      return res.status(500).json({ error: 'No element found for selector: #pass', details: 'Login page did not show a password input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
    }
    await page.type(passSel, fbPassword, { delay: 50 });

    const loginBtn = await page.$('button[name="login"], button[type="submit"], button#loginbutton');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      try { await page.click('button[name="login"]'); } catch (e) { /* ignore */ }
    }
    // Quick-check for 2FA/checkpoint within 3s so UI can prompt user immediately
    try {
      // Use the robust selector finder to detect 2FA input or checkpoint button
      const sel2fa = await findSelector(page, TWO_FA_SELECTORS, 3000);
      const selCheckpoint = await findSelector(page, CHECKPOINT_BUTTON_SELECTORS, 3000);
      const selCaptcha = await findSelector(page, CAPTCHA_SELECTORS, 3000);
      if (selCaptcha) {
        // save debug snapshot and return captcha_required so UI can instruct user
        try {
          const snapName = `${userId}_${Date.now()}_captcha.png`;
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          const htmlName = `${userId}_${Date.now()}_captcha.html`;
          const htmlPath = path.join(COOKIES_DIR, htmlName);
          await fs.promises.writeFile(htmlPath, await page.content(), { encoding: 'utf8', mode: 0o600 });
          const ws = headful ? browser.wsEndpoint() : undefined;
          return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected. Please solve it in the opened browser window.', matched: { selCaptcha }, debug: { screenshot: path.join(COOKIES_DIR, snapName), html: htmlPath }, wsEndpoint: ws });
        } catch (e) { console.warn('failed to save captcha debug artifacts', e); return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected. Please solve it.' }); }
      }
      if (sel2fa || selCheckpoint) {
        // record which selector matched to help debugging
        try {
          const snapName = `${userId}_${Date.now()}_2fa.png`;
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          const htmlName = `${userId}_${Date.now()}_2fa.html`;
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save 2fa debug artifacts', e); }
        const ws = headful ? browser.wsEndpoint() : undefined;
        return res.json({ status: '2fa_required', sessionId, message: 'Two-factor authentication required. Please enter the code shown on your device.', matched: { sel2fa, selCheckpoint }, wsEndpoint: ws });
      }
    } catch (e) { /* ignore */ }

    // Otherwise wait for session cookies (c_user and xs) to appear (up to 30s)
    const cookies = await waitForSessionCookies(page, Math.max(TIMEOUT, 30000));

    // detect session presence
    const names = cookies.map(c => c.name);
    const hasSession = names.includes('c_user') && names.includes('xs');
    if (!hasSession) {
      // If no session cookies present, save debug snapshot and return informative error
      try {
        const snapName = `${userId}_${Date.now()}_no_session.png`;
        await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
        const htmlName = `${userId}_${Date.now()}_no_session.html`;
        await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
      } catch (e) { console.warn('failed to save debug artifacts', e); }
      console.warn('login completed but session cookies (c_user/xs) not present; captured cookie names:', names);
      return res.status(500).json({ error: 'Login did not produce session cookies (c_user/xs). Check for checkpoint/2FA or site changes.' });
    }

    // Save cookie file only if full session cookies are present
    const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
    if (!saved.saved) {
      return res.status(500).json({ error: 'Login did not produce full session cookies (c_user/xs). Check for checkpoint/2FA or site changes.' });
    }
    const filepath = saved.filepath;

    // encrypt and save to DB if possible
    let encrypted;
    try { encrypted = encryptJSON(cookies); } catch (e) { console.error('encrypt failed', e); }

    // If MongoDB is not connected, skip DB write but keep file
    if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not configured or not connected — skipping DB update (cookies saved to file only)');
      await cleanupSession(sessionId);
      return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
    }

    try {
      // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
      await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
    } catch (dbErr) {
      console.error('Failed to update user in DB:', dbErr.message || dbErr);
      await cleanupSession(sessionId);
      return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
    }

    await cleanupSession(sessionId);

    return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
  } catch (err) {
    console.error('facebook/start error', err);
    await cleanupSession(sessionId);
    return res.status(500).json({ error: 'Failed to capture cookies', details: err.message });
  }
});

// POST /api/facebook/open-headful
// Starts a headful browser session and navigates to Facebook login without performing automated typing.
router.post('/open-headful', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: 'Missing user context' });
  const sessionId = uuidv4();
  let browser;
  try {
    // Use a fresh user data dir to avoid inherited DevTools/extension state
    const userDataDir = path.join(os.tmpdir(), `puppeteer_profile_${sessionId}`);
    const launchOpts = {
      headless: false,
      devtools: false,
      slowMo: 0,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--start-maximized',
        '--window-size=1280,800'
      ]
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

    // Try to launch headful browser. If it fails due to missing X server,
    // attempt to start a local Xvfb and retry. As a last resort, fall back
    // to headless mode so the endpoint remains usable in restrictive envs.
    try {
      browser = await puppeteer.launch(launchOpts);
    } catch (err) {
      console.warn('open-headful error on first launch', err && (err.message || err));
      const msg = (err && err.message) || '';
      if (msg.includes('Missing X server') || msg.includes('cannot open display') || msg.includes('No protocol specified')) {
        console.log('Attempting to start Xvfb and retry Puppeteer launch...');
        const { spawn } = require('child_process');
        // Start Xvfb on display :99
        const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x720x24', '-ac'], { stdio: 'ignore' });
        // Give Xvfb a moment to start
        await new Promise((resolve) => setTimeout(resolve, 800));
        process.env.DISPLAY = ':99';
        try {
          browser = await puppeteer.launch(launchOpts);
        } catch (err2) {
          console.warn('Retry after starting Xvfb failed:', err2 && (err2.message || err2));
          try { xvfb.kill(); } catch (e) {}
          // Fallback: try headless mode to keep functionality
          console.log('Falling back to headless mode for Puppeteer launch.');
          launchOpts.headless = 'new';
          try {
            browser = await puppeteer.launch(launchOpts);
          } catch (err3) {
            console.error('Final Puppeteer launch attempt (headless) also failed:', err3 && (err3.stack || err3.message || err3));
            throw err3;
          }
        }
      } else {
        throw err;
      }
    }
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT);
    sessions.set(sessionId, { browser, page, createdAt: Date.now(), userId });
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' }).catch(() => {});
    const ws = browser.wsEndpoint ? browser.wsEndpoint() : undefined;

    // Start a background watcher that watches the page URL and cookies.
    // If the user navigates to their profile/home page or cookies appear,
    // save cookies and close the browser promptly.
    (async () => {
      try {
        const profileIndicators = ['/profile.php', '/me', '/home', '/settings', '/friends', '/photos'];
        const start = Date.now();
        const deadline = start + MAX_CAPTURE_WAIT_MS; // configurable max wait
        console.log(`facebookCapture: watcher started for session ${sessionId}, waiting up to ${MAX_CAPTURE_WAIT_MS}ms`);
        while (Date.now() < deadline) {
          try {
            // First, check cookies immediately — if c_user & xs present, save and exit
            const cookiesNow = await page.cookies().catch(() => []);
            const namesNow = (cookiesNow || []).map(c => c.name);
            if (namesNow.length > 0) console.log(`facebookCapture: session=${sessionId} seen cookie names: ${namesNow.join(',')}`);
            if (namesNow.includes('c_user') && namesNow.includes('xs')) {
              const filename = `${userId}_${Date.now()}.json`;
              const filepath = path.join(COOKIES_DIR, filename);
              const savedNow = await saveCookiesSafely(sessionId, userId, cookiesNow || [], false);
              if (!savedNow.saved) {
                // not a full session yet, keep waiting
              } else {
                await cleanupSession(sessionId);
                console.log(`facebookCapture: open-headful watcher saved cookies and closed session ${sessionId} (cookies detected)`);
                return;
              }
              await cleanupSession(sessionId);
              console.log(`facebookCapture: open-headful watcher saved cookies and closed session ${sessionId} (cookies detected)`);
              return;
            }

            const currentUrl = page.url();
            // quick check: if user reached a profile/home-like URL
            if (profileIndicators.some(ind => currentUrl.includes(ind))) {
              console.log(`facebookCapture: session=${sessionId} profile URL detected: ${currentUrl}`);
              // User has likely navigated to profile/home.
              const cookiesQuick = cookiesNow;
              const namesQuick = (cookiesQuick || []).map(c => c.name);
              const hasSessionQuick = namesQuick.includes('c_user') && namesQuick.includes('xs');
              if (waitForFullSession) {
                // Wait for full session cookies; if present, save+close; otherwise continue waiting.
                if (hasSessionQuick) {
                  const filename = `${userId}_${Date.now()}.json`;
                  const filepath = path.join(COOKIES_DIR, filename);
                  const savedQuick = await saveCookiesSafely(sessionId, userId, cookiesQuick || [], false);
                  if (!savedQuick.saved) {
                    // not a full session yet, continue waiting
                  } else {
                    await cleanupSession(sessionId);
                    console.log(`facebookCapture: open-headful watcher saved cookies and closed session ${sessionId} (profile URL detected, full session present)`);
                    return;
                  }
                }
                // otherwise continue waiting for c_user/xs
              } else {
                // Old behavior: save whatever cookies exist and close promptly
                const filename = `${userId}_${Date.now()}.json`;
                const filepath = path.join(COOKIES_DIR, filename);
                const savedQuick2 = await saveCookiesSafely(sessionId, userId, cookiesQuick || [], false);
                if (savedQuick2.saved) {
                  await cleanupSession(sessionId);
                  console.log(`facebookCapture: open-headful watcher saved cookies and closed session ${sessionId} (profile URL detected)`);
                  return;
                }
              }
            }
          } catch (e) {
            // ignore transient errors
          }
          await sleep(1000);
        }
        // timeout reached: do not keep browser open indefinitely
        await cleanupSession(sessionId);
        console.log(`facebookCapture: open-headful watcher timeout, closed session ${sessionId}`);
      } catch (e) {
        console.warn('open-headful watcher error', e && e.message ? e.message : e);
      }
    })();

    return res.json({ status: 'ok', message: 'Headful browser opened. Please complete login manually in the opened window.', sessionId, wsEndpoint: ws });
  } catch (err) {
    console.error('open-headful error', err);
    try { if (browser) await browser.close(); } catch (_) {}
    sessions.delete(sessionId);
    return res.status(500).json({ error: 'Failed to open headful browser', details: err.message });
  }
});

  // GET /api/facebook/session-screenshot/:sessionId
  // Returns a PNG screenshot of the current Puppeteer page for the given sessionId.
  router.get('/session-screenshot/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params || {};
      if (!sessionId) return res.status(400).json({ error: 'Missing sessionId param' });
      const session = sessions.get(sessionId);
      if (!session) return res.status(410).json({ error: 'Session not found or expired' });
      const { page } = session;
      if (!page) return res.status(500).json({ error: 'No page available for session' });
      const buffer = await page.screenshot({ type: 'png', fullPage: false }).catch(err => { throw err; });
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(buffer);
    } catch (err) {
      console.error('session-screenshot error', err && (err.stack || err.message || err));
      return res.status(500).json({ error: 'Failed to capture screenshot', details: err && (err.message || String(err)) });
    }
  });

// WebSocket proxy endpoint so the browser DevTools can connect to the launched Chromium instance.
// Client should open a WebSocket to wss://<host>/api/facebook/ws/<sessionId> and include Authorization header.
// The server will validate the JWT in Authorization and then forward messages between the client and
// the Chromium DevTools WebSocket endpoint.
router.ws('/ws/:sessionId', async function (clientWs, req) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    // Support token via Authorization header or query param (?token=...)
    let token = authHeader.split(' ')[1];
    if (!token && req && req.query && req.query.token) token = req.query.token;
    if (!token) return clientWs.close(1008, 'Missing auth token');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return clientWs.close(1008, 'Invalid token');
    }
    const sessionId = req.params.sessionId;
    const session = sessions.get(sessionId);
    if (!session) return clientWs.close(1008, 'Session not found');
    if (session.userId !== decoded.userId) return clientWs.close(1008, 'Forbidden');

    // Determine target DevTools websocket endpoint
    const target = session.browser && session.browser.wsEndpoint ? session.browser.wsEndpoint() : session.wsEndpoint;
    if (!target) return clientWs.close(1011, 'No browser endpoint available');

    const proxied = new WebSocket(target);
    proxied.on('open', () => {
      // forward messages
      proxied.on('message', (msg) => {
        try { clientWs.send(msg); } catch (e) { /* ignore */ }
      });
      clientWs.on('message', (msg) => {
        try { proxied.send(msg); } catch (e) { /* ignore */ }
      });
    });
    proxied.on('close', () => { try { clientWs.close(); } catch (e) {} });
    proxied.on('error', (err) => { console.error('ws proxy target error', err && (err.stack || err)); clientWs.close(1011, 'Proxy target error'); });
    clientWs.on('close', () => { try { proxied.close(); } catch (e) {} });
  } catch (e) {
    console.error('ws proxy handler error', e && (e.stack || e.message || e));
    try { clientWs.close(1011, 'Server error'); } catch (e) {}
  }
});

// POST /api/facebook/upload-cookies
// Accepts cookies from the user's browser (array or raw string) and saves them using saveCookiesSafely.
router.post('/upload-cookies', async (req, res) => {
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

    // normalize cookie objects to shape expected by saveCookiesSafely: {name, value, domain, path, expires, httpOnly, secure}
    const normalized = cookies.map((c) => {
      if (!c) return null;
      return {
        name: c.name || c.key || c.N || '',
        value: c.value || c.v || c.V || '',
        domain: c.domain || c.Domain || '.facebook.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.expiry || null,
        httpOnly: !!c.httpOnly || !!c.httpOnly === true || !!c.httpOnly === false ? !!c.httpOnly : !!c.http_only || !!c.httpOnly,
        secure: !!c.secure,
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

    // Optionally mark the user connected in DB
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

// Create a short-lived inspect token for a session (returns a wss proxy URL with token)
router.post('/inspect-token/:sessionId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  try {
    const token = require('jsonwebtoken').sign({ sessionId, userId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const host = req.get('host');
    const wsUrl = `wss://${host}/api/facebook/ws/${sessionId}?token=${encodeURIComponent(token)}`;
    return res.json({ wsUrl, expiresIn: 300 });
  } catch (e) {
    console.error('inspect-token error', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Failed to create inspect token' });
  }
});

// POST /api/facebook/vnc-token
// Generates a short-lived VNC password, restarts x11vnc to apply it, and
// returns the noVNC URL + password (expires in 5 minutes).
router.post('/vnc-token', authenticateToken, async (req, res) => {
  const userId = req.userId;
  try {
    const password = crypto.randomBytes(8).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
    const authFile = '/tmp/vnc_passwd';
    // Store the password into x11vnc auth file
    try {
      // x11vnc -storepasswd <pw> <file>
      execSync(`x11vnc -storepasswd ${password} ${authFile}`);
    } catch (e) {
      console.error('Failed to create vnc passwd file', e && (e.message || e));
      return res.status(500).json({ error: 'Failed to create VNC password' });
    }

    // Restart x11vnc to pick up new password
    try {
      execSync('pkill x11vnc || true');
      // Start in background
      spawn('x11vnc', ['-display', ':99', '-rfbauth', authFile, '-forever', '-shared', '-rfbport', '5900'], { detached: true, stdio: 'ignore' }).unref();
    } catch (e) {
      console.error('Failed to restart x11vnc', e && (e.message || e));
      // still return URL but note error
    }

    const host = req.get('host');
    const url = `https://${host}/vnc.html`;
    // Note: noVNC is served at /vnc.html by websockify (noVNC's default path)
    return res.json({ url, password, expiresIn: 300 });
  } catch (e) {
    console.error('vnc-token error', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Failed to generate VNC token' });
  }
});

// Close a running session and clean up resources (browser + Xvfb)
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  try {
    await cleanupSession(sessionId);
    return res.json({ status: 'ok', message: 'Session closed' });
  } catch (e) {
    console.error('session close error', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Failed to close session' });
  }
});

// Return an inspection URL that clients can use to connect DevTools via the proxy
router.get('/inspect/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const host = req.get('host');
  // Use wss since the site is served over https in production
  const wsUrl = `wss://${host}/api/facebook/ws/${sessionId}`;
  return res.json({ wsUrl, note: 'Open Chrome > More Tools > Remote devices > Configure... and add this ws target, or use chrome://inspect to add the target.' });
});

// POST /api/facebook/submit-2fa
router.post('/submit-2fa', async (req, res) => {
  const userId = req.userId;
  const { sessionId, code } = req.body;
  if (!sessionId || !code || !userId) return res.status(400).json({ error: 'Missing required fields' });
  let session = sessions.get(sessionId);
    if (!session) {
    // Session not found in memory — maybe the watcher already saved cookies and closed the browser.
    // Check savedSessions map or a session marker file on disk.
    const saved = savedSessions.get(sessionId);
    if (saved) {
      // Cookies were previously saved for this session. Do not claim the user is "connected";
      // return a neutral confirmation that cookies exist and when they were saved.
      return res.json({ status: 'ok', message: 'Cookies previously saved', filepath: saved.filepath, cookiesSavedAt: new Date(saved.savedAt).toISOString() });
    }
    // fallback: check for marker file on disk
    const markerPath = path.join(COOKIES_DIR, `session_${sessionId}.json`);
    if (fs.existsSync(markerPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
        return res.json({ status: 'ok', message: 'Cookies previously saved', filepath: data.filepath, cookiesSavedAt: new Date(data.savedAt).toISOString() });
      } catch (e) {
        // continue to return 410 below
      }
    }
    return res.status(410).json({ error: 'Session not found or expired' });
  }
  if (session.userId !== userId) return res.status(403).json({ error: 'Session does not belong to this user' });
  if (!session) return res.status(410).json({ error: 'Session not found or expired' });

  const { page, browser } = session;
  try {
    const codeSel = await findSelector(page, TWO_FA_SELECTORS, 1500);
    if (!codeSel) return res.status(401).json({ status: 'failed', message: '2FA input not found; try again' });
    try {
      await page.focus(codeSel);
      await page.keyboard.type(code, { delay: 50 });
    } catch (e) {
      try { await page.type(codeSel, code, { delay: 50 }); } catch (ee) { console.warn('typing into 2FA field failed', ee); }
    }
    const btnSel = await findSelector(page, CHECKPOINT_BUTTON_SELECTORS, 1500);
    if (btnSel) {
      try { await page.click(btnSel); } catch (e) { console.warn('clicking checkpoint button failed', e); }
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT });

    if (page.url().includes('login') || page.url().includes('checkpoint')) {
      return res.status(401).json({ status: 'failed', message: '2FA code not accepted; try again' });
    }

    // optional post-2FA wait (ms) to allow site to set cookies; default to 10s
    // optional post-2FA wait (ms) to allow site to set cookies; default to 30s
    let postWaitMs = parseInt(String(req.body && req.body.waitMs || ''), 10) || 30000;
    if (postWaitMs < 0) postWaitMs = 0;
    if (postWaitMs > 5 * 60 * 1000) postWaitMs = 5 * 60 * 1000; // cap 5 minutes
    await sleep(postWaitMs);
    const cookies = await waitForSessionCookies(page, Math.max(10000, postWaitMs + 10000));
    const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
    if (!saved.saved) return res.json({ status: 'no_session', message: 'Session cookies not present after post-2FA wait', cookies, retryAfterMs: 3000 });
    const filepath = saved.filepath;

    // encrypt and save to DB if possible
    let encrypted;
    try { encrypted = encryptJSON(cookies); } catch (e) { console.error('encrypt failed', e); }

    // If MongoDB is not connected, skip DB write but keep file
    if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not configured or not connected — skipping DB update (cookies saved to file only)');
      await cleanupSession(sessionId);
      return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
    }

    try {
      // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
      await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
    } catch (dbErr) {
      console.error('Failed to update user in DB:', dbErr.message || dbErr);
      await cleanupSession(sessionId);
      return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
    }

    await cleanupSession(sessionId);

    return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
  } catch (err) {
    console.error('facebook/2fa error', err);
    await cleanupSession(sessionId);
    return res.status(500).json({ error: '2FA submission failed', details: err.message });
  }
});

// POST /api/facebook/check-session (authenticated)
router.post('/check-session', async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.body || {};
  // optional wait time in ms
  let waitMs = parseInt(String(req.body && req.body.waitMs || ''), 10) || 0;
  if (waitMs > 10 * 60 * 1000) waitMs = 10 * 60 * 1000;
  if (!sessionId) return res.status(400).json({ error: 'Missing required field: sessionId' });
  const session = sessions.get(sessionId);
  if (!session) return res.status(410).json({ error: 'Session not found or expired' });
  if (session.userId !== userId) return res.status(403).json({ error: 'Session does not belong to this user' });
  const { page, browser } = session;
  // post detect/captcha waits
  let postDetectWaitMs = parseInt(String(req.body && req.body.postDetectWaitMs || ''), 10);
  if (Number.isNaN(postDetectWaitMs)) postDetectWaitMs = 10000;
  if (postDetectWaitMs < 0) postDetectWaitMs = 0;
  if (postDetectWaitMs > 60 * 1000) postDetectWaitMs = 60 * 1000;
  let postCaptchaWaitMs = parseInt(String(req.body && req.body.postCaptchaWaitMs || ''), 10);
  if (Number.isNaN(postCaptchaWaitMs)) postCaptchaWaitMs = 10000;
  if (postCaptchaWaitMs < 0) postCaptchaWaitMs = 0;
  if (postCaptchaWaitMs > 5 * 60 * 1000) postCaptchaWaitMs = 5 * 60 * 1000;

  try {
    const checkTimeout = waitMs && waitMs > 0 ? waitMs : 1000;
    const cookies = await waitForSessionCookies(page, checkTimeout);
    const names = (cookies || []).map(c => c.name);
    const hasSession = names.includes('c_user') && names.includes('xs');
    const captchaSel = await findSelector(page, CAPTCHA_SELECTORS, 1000);
    if (captchaSel) {
      if (postCaptchaWaitMs > 0) {
        await sleep(postCaptchaWaitMs);
        const cookiesAfter = await waitForSessionCookies(page, Math.min(postCaptchaWaitMs + 5000, 60000));
        const namesAfter = (cookiesAfter || []).map(c => c.name);
        const hasSessionAfter = namesAfter.includes('c_user') && namesAfter.includes('xs');
        if (!hasSessionAfter) {
          try {
            const snapName = `${userId}_${Date.now()}_captcha_waited.png`;
            const htmlName = `${userId}_${Date.now()}_captcha_waited.html`;
            await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
            await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
          } catch (e) { console.warn('failed to save captcha_waited debug artifacts', e); }
          return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA present; solved but no session cookies yet' });
        }
        cookies.splice(0, cookies.length, ...(cookiesAfter || []));
      } else {
        return res.json({ status: 'captcha_required', sessionId, message: 'CAPTCHA detected. Please solve it in the opened browser window.' });
      }
    }

    // If we don't yet have the required session cookies, report no_session
    if (!hasSession) {
      return res.json({ status: 'no_session', message: 'Session cookies not present yet', cookies: cookies || [], retryAfterMs: 3000 });
    }

    if (hasSession && postDetectWaitMs > 0) {
      await sleep(postDetectWaitMs);
      const cookies2 = await page.cookies().catch(() => []);
      const names2 = (cookies2 || []).map(c => c.name);
      if (!names2.includes('c_user') || !names2.includes('xs')) {
        console.warn('session cookies disappeared after postDetect wait; names before:', names, 'after:', names2);
        return res.json({ status: 'no_session', message: 'Session cookies not present after post-detect wait', cookies: cookies2 || [], retryAfterMs: 3000 });
      }
      cookies.splice(0, cookies.length, ...(cookies2 || []));
    }

    // Save cookie file
    const filename = `${userId}_${Date.now()}.json`;
    const filepath = path.join(COOKIES_DIR, filename);
    try { const saved = await saveCookiesSafely(sessionId, userId, cookies, false); if (!saved.saved) { return res.json({ status: 'no_session', message: 'Session cookies not present', cookies, retryAfterMs: 3000 }); } filepath = saved.filepath; } catch (e) { console.error('Failed to save cookies safely:', e); }
    let encrypted; try { encrypted = encryptJSON(cookies); } catch (e) { console.error('encrypt failed', e); }
    if (!process.env.MONGODB_URI || mongoose.connection.readyState !== 1) {
      try { await browser.close(); } catch (_) {}
      sessions.delete(sessionId);
      return res.json({ status: 'ok', message: 'Cookies saved to file; MongoDB not configured so DB update skipped', filepath });
    }
    try { await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath }); } catch (dbErr) { try { await browser.close(); } catch (_) {} sessions.delete(sessionId); return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, cookiesSavedAt: new Date().toISOString(), dbError: dbErr.message || String(dbErr) }); }

    try { await browser.close(); } catch (_) {}
    sessions.delete(sessionId);
    return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath, cookiesSavedAt: new Date().toISOString() });
  } catch (err) {
    console.error('check-session error', err);
    try { await browser.close(); } catch (_) {}
    sessions.delete(sessionId);
    return res.status(500).json({ error: 'Check session failed', details: err.message });
  }
});

module.exports = router;

// Periodic cleanup: close stale sessions older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.createdAt > 10 * 60 * 1000) {
      try {
        if (s.browser) s.browser.close();
      } catch (e) {}
      sessions.delete(id);
      console.log(`facebookCapture: cleaned up stale session ${id}`);
    }
  }
}, 60 * 1000);

// === Development-only helper routes ===
// These routes are only enabled when NODE_ENV === 'development'. They bypass JWT auth
// and are intended for quick local testing only. Do NOT enable in production.
if (process.env.NODE_ENV === 'development') {
  console.warn('facebookCapture: development-only routes enabled (dev-start, dev-submit-2fa)');

  // POST /api/facebook/dev-start
  router.post('/dev-start', async (req, res) => {
    const { userId, fbEmail, fbPassword } = req.body;
    if (!userId || !fbEmail || !fbPassword) return res.status(400).json({ error: 'Missing required fields' });
    // Reuse the same logic as /start but bypass auth and use given userId
    try {
      const sessionId = uuidv4();
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      page.setDefaultTimeout(TIMEOUT);
      sessions.set(sessionId, { browser, page, createdAt: Date.now(), userId });
      await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });

      const emailSel = await findSelector(page, ['#email', 'input[name="email"]', 'input[type="email"]'], 8000);
      if (!emailSel) {
        const snapName = `${userId}_${Date.now()}_no_email.png`;
        const htmlName = `${userId}_${Date.now()}_no_email.html`;
        try {
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save no_email debug artifacts', e); }
        await browser.close();
        sessions.delete(sessionId);
        return res.status(500).json({ error: 'Dev start failed', details: 'No element found for selectors: email input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
      }
      await page.type(emailSel, fbEmail, { delay: 50 });

      const passSel = await findSelector(page, ['#pass', 'input[name="pass"]', 'input[type="password"]'], 8000);
      if (!passSel) {
        const snapName = `${userId}_${Date.now()}_no_pass.png`;
        const htmlName = `${userId}_${Date.now()}_no_pass.html`;
        try {
          await page.screenshot({ path: path.join(COOKIES_DIR, snapName), fullPage: true });
          await fs.promises.writeFile(path.join(COOKIES_DIR, htmlName), await page.content(), { encoding: 'utf8', mode: 0o600 });
        } catch (e) { console.warn('failed to save no_pass debug artifacts', e); }
        await browser.close();
        sessions.delete(sessionId);
        return res.status(500).json({ error: 'Dev start failed', details: 'No element found for selectors: password input', url: page.url(), screenshot: path.join(COOKIES_DIR, snapName), html: path.join(COOKIES_DIR, htmlName) });
      }
      await page.type(passSel, fbPassword, { delay: 50 });

      const loginBtn = await page.$('button[name="login"], button[type="submit"], button#loginbutton');
      if (loginBtn) {
        await loginBtn.click();
      } else {
        try { await page.click('button[name="login"]'); } catch (e) { /* ignore */ }
      }
      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT }),
          page.waitForSelector('input[name="approvals_code"]', { timeout: TIMEOUT }),
          page.waitForSelector('#checkpointSubmitButton', { timeout: TIMEOUT }),
        ]);
      } catch (e) {}

      const twoFASelector = await page.$('input[name="approvals_code"], input#approvals_code');
      const checkpoint = await page.$('#checkpointSubmitButton, #checkpointSubmitButton');
      if (twoFASelector || checkpoint) {
        // include wsEndpoint for debugging when headful
        const ws = headful ? browser.wsEndpoint() : undefined;
        return res.json({ status: '2fa_required', sessionId, message: 'Two-factor authentication required. Please enter the code shown on your device.', wsEndpoint: ws });
      }

      const cookies = await page.cookies();
      const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
      if (!saved.saved) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'no_session', message: 'Session cookies not present', cookies, retryAfterMs: 3000 });
      }
      const filepath = saved.filepath;

      try {
        // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
        await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
      } catch (dbErr) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
      }

      await browser.close();
      sessions.delete(sessionId);
      return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
    } catch (err) {
      console.error('dev-start error', err);
      return res.status(500).json({ error: 'Dev start failed', details: err.message });
    }
  });

  // POST /api/facebook/dev-submit-2fa
  router.post('/dev-submit-2fa', async (req, res) => {
    const { sessionId, code, userId } = req.body;
    if (!sessionId || !code || !userId) return res.status(400).json({ error: 'Missing required fields' });
    const session = sessions.get(sessionId);
    if (!session) return res.status(410).json({ error: 'Session not found or expired' });
    if (session.userId !== userId) return res.status(403).json({ error: 'Session does not belong to this user' });
    const { page, browser } = session;
    try {
        const codeSel = await findSelector(page, TWO_FA_SELECTORS, 1500);
        if (!codeSel) return res.status(401).json({ status: 'failed', message: '2FA input not found; try again' });
        try {
          await page.focus(codeSel);
          await page.keyboard.type(code, { delay: 50 });
        } catch (e) {
          try { await page.type(codeSel, code, { delay: 50 }); } catch (ee) { console.warn('typing into 2FA field failed', ee); }
        }
        const btnSel = await findSelector(page, CHECKPOINT_BUTTON_SELECTORS, 1500);
        if (btnSel) {
          try { await page.click(btnSel); } catch (e) { console.warn('clicking checkpoint button failed', e); }
        }
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUT });
      if (page.url().includes('login') || page.url().includes('checkpoint')) {
        return res.status(401).json({ status: 'failed', message: '2FA code not accepted; try again' });
      }

      const cookies = await page.cookies();
      const saved = await saveCookiesSafely(sessionId, userId, cookies, false);
      if (!saved.saved) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'no_session', message: 'Session cookies not present', cookies, retryAfterMs: 3000 });
      }
      const filepath = saved.filepath;

      try {
        // Persist cookie metadata only — do not mark the user `facebookConnected` automatically.
        await User.findByIdAndUpdate(userId, { facebookCookiesEncrypted: encrypted, facebookCookiesPath: filepath });
      } catch (dbErr) {
        await browser.close();
        sessions.delete(sessionId);
        return res.json({ status: 'ok', message: 'Cookies saved to file but failed to update DB', filepath, dbError: dbErr.message || String(dbErr) });
      }

      await browser.close();
      sessions.delete(sessionId);
      return res.json({ status: 'ok', message: 'Cookies captured and saved', filepath });
    } catch (err) {
      console.error('dev-submit-2fa error', err);
      try { await browser.close(); } catch (_) {}
      sessions.delete(sessionId);
      return res.status(500).json({ error: 'Dev submit 2FA failed', details: err.message });
    }
  });
}
