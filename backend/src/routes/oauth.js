const express = require('express');
const router = express.Router();
// Compatibility route for frontend: /api/oauth/connect/facebook
router.get('/connect/facebook', (req, res) => {
  res.redirect('/api/oauth/facebook');
});
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  // Accept token from several sources for convenience in dev:
  // - Authorization: Bearer <token>
  // - x-access-token header
  // - x-debug-token header
  // - ?token= query param
  const header = req.headers.authorization || req.headers['x-access-token'] || req.headers['x-debug-token'];
  const queryToken = req.query && req.query.token;
  let token = null;

  if (header && typeof header === 'string') {
    token = header.startsWith('Bearer ') ? header.split(' ')[1] : header;
  } else if (queryToken) {
    token = queryToken;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Get connected social accounts for authenticated user
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const accounts = [];
    
    if (user.facebookConnected && user.facebookId) {
      accounts.push({
        platform: 'facebook',
        username: user.facebookName,
        email: user.facebookEmail,
        connected_at: user.facebookConnectedAt,
      });
    }
    
    res.json({ 
      accounts,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        facebookConnected: !!user.facebookConnected,
        facebookConnectedAt: user.facebookConnectedAt ? user.facebookConnectedAt : undefined,
        facebookName: user.facebookName,
        facebookEmail: user.facebookEmail
      }
    });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Disconnect a social account
router.delete('/disconnect/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (platform === 'facebook') {
      user.facebookId = undefined;
      user.facebookAccessToken = undefined;
      user.facebookName = undefined;
      user.facebookEmail = undefined;
      user.facebookConnected = false;
      user.facebookConnectedAt = undefined;
      await user.save();
      return res.json({ message: 'Facebook account disconnected' });
    }

    // Facebook Analysis disconnect: remove cookies and related fields
    if (platform === 'facebook-analysis') {
      user.facebookCookiesEncrypted = null;
      user.facebookCookiesPath = null;
      // Optionally, you can add a flag or timestamp if you want to track analysis connection
      await user.save();
      return res.json({ message: 'Facebook analysis disconnected' });
    }

    res.status(400).json({ message: 'Invalid platform' });
  } catch (err) {
    console.error('Error disconnecting account:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
// Use webhook service for testing (switch to scraperService for production)
const scraperService = require('../services/scraperWebhookService');

// Facebook OAuth endpoints
router.get('/facebook', (req, res) => {
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  
  // Extract token from Authorization header, x-access-token/x-debug-token, or query param
  const header = req.headers.authorization || req.headers['x-access-token'] || req.headers['x-debug-token'];
  let state = '';

  if (header && typeof header === 'string') {
    state = header.startsWith('Bearer ') ? header.substring(7) : header;
  } else if (req.query.token) {
    state = req.query.token;
  }
  // If a state token was provided, verify it now so we do not redirect to Facebook with an
  // invalid/malformed token that will fail on callback verification.
  if (state) {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      console.log('[OAuth] /facebook requested - valid state token for userId:', decoded.userId ? decoded.userId : '[unknown]');
    } catch (err) {
      console.warn('[OAuth] /facebook requested - invalid state token:', err && err.message ? err.message : String(err));
      const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
      const frontendUrl = `${frontendBase}/social-accounts`;
      const params = new URLSearchParams({ error: 'facebook', details: 'Invalid or expired session token — please sign in and try again' });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
    }
  } else {
    console.log('[OAuth] /facebook requested - no state token supplied');
  }

  // Build the OAuth URL and redirect to Facebook
  const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile&state=${encodeURIComponent(state)}`;
  console.log('[OAuth] redirecting to Facebook OAuth URL', fbAuthUrl.replace(/(state=)[^&]+/, '$1[snipped]'));
  res.redirect(fbAuthUrl);
});

router.get('/facebook/callback', async (req, res) => {
  const { code, state } = req.query;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!code) return res.status(400).send('No code provided');

  try {
    // Decode the state parameter to get the user's JWT token
    let userId = null;
    if (state) {
      try {
        const decoded = jwt.verify(state, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        // log more context to help debugging
        console.error('[OAuth] Invalid state token during callback verify:', err.message, 'statePreview=', state ? state.slice(0, 12) + '...' : 'none');
        // Try a non-verified decode to inspect payload (useful for debugging only)
        try {
          const raw = jwt.decode(state);
          console.log('[OAuth] Decoded state (no verify):', raw);
        } catch (dErr) {
          console.warn('[OAuth] Failed to decode state for debugging:', dErr && dErr.message ? dErr.message : dErr);
        }
      }
    }

    // If no valid state/userId was found, redirect with a clearer error message
    if (!userId) {
      console.warn('[OAuth] No valid state token/userId found in callback; refusing to link account.');
      const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
      const frontendUrl = `${frontendBase}/social-accounts`;
      const params = new URLSearchParams({
        error: 'facebook',
        details: 'Missing or invalid state token — please login first and retry connecting Facebook',
      });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
    }

    // Exchange code for access token
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: clientId,
        redirect_uri: redirectUri,
        client_secret: clientSecret,
        code,
      },
    });
    const accessToken = tokenRes.data.access_token;

    // Get user info
    const userRes = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name,email',
      },
    });
    const fbUser = userRes.data;

    // Update the logged-in user with Facebook data
    let user;
    if (!userId) {
      // No logged-in user - redirect back with error
      const frontendBase = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const frontendUrl = `${frontendBase}/social-accounts`;
      const params = new URLSearchParams({
        error: 'facebook',
        details: 'Please login first before connecting Facebook',
      });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
    }
    
    // Link Facebook to the currently logged-in user
    user = await User.findById(userId);
    if (!user) {
      const frontendBase = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const frontendUrl = `${frontendBase}/social-accounts`;
      const params = new URLSearchParams({
        error: 'facebook',
        details: 'User not found',
      });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
    }
    
    user.facebookId = fbUser.id;
    user.facebookAccessToken = accessToken;
    user.facebookName = fbUser.name;
    user.facebookEmail = fbUser.email;
    user.facebookConnected = true;
    user.facebookConnectedAt = new Date();
    await user.save();
      
      // Start background scraping job (non-blocking)
      scraperService.startScraping(user)
        .then(job => {
          console.log(`[OAuth] Scraping job started: ${job.jobId}`);
        })
        .catch(err => {
          console.error(`[OAuth] Failed to start scraping: ${err.message}`);
        });
      
      // Create a JWT for frontend authentication and redirect with it
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      // Always use localhost for frontend since only backend is deployed
      const frontendBase = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const frontendUrl = `${frontendBase}/social-accounts`;
      const params = new URLSearchParams({
        success: 'true',
        platform: 'facebook',
        username: user.username || '',
        token,
      });
      const redirectUrl = `${frontendUrl}?${params.toString()}`;
      console.log('[OAuth] Redirecting to frontend with token:', { userId: user._id, redirectUrl });
      return res.redirect(redirectUrl);
  } catch (err) {
      console.error('Facebook OAuth error:', err.response?.data || err.message || err);
      // Redirect to frontend with error - always use localhost since only backend is deployed
    const frontendBase = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = `${frontendBase}/social-accounts`;
    const params = new URLSearchParams({
      error: 'facebook',
      details: err.response?.data?.error?.message || err.message || 'Facebook OAuth failed',
    });
    return res.redirect(`${frontendUrl}?${params.toString()}`);
  }
});

module.exports = router;

// Development-only: verify a JWT token quickly for debugging purposes
if (process.env.NODE_ENV === 'development') {
  router.get('/debug-verify-token', (req, res) => {
    const token = req.query.token || req.headers['x-debug-token'];
    if (!token) return res.status(400).json({ error: 'Missing token query param or x-debug-token header' });
    try {
      const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
      return res.json({ valid: true, decoded });
    } catch (err) {
      const decoded = jwt.decode(String(token));
      return res.json({ valid: false, error: err && err.message ? err.message : String(err), decoded });
    }
  });
}
