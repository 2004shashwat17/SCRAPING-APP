const express = require('express');
const router = express.Router();
// Compatibility route for frontend: /api/oauth/connect/facebook
router.get('/connect/facebook', (req, res) => {
  res.redirect('/api/oauth/facebook');
});
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
// Use webhook service for testing (switch to scraperService for production)
const scraperService = require('../services/scraperWebhookService');

// Facebook OAuth endpoints
router.get('/facebook', (req, res) => {
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email,public_profile`;
  res.redirect(fbAuthUrl);
});

router.get('/facebook/callback', async (req, res) => {
  const { code } = req.query;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!code) return res.status(400).send('No code provided');

  try {
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

    // Save or update user in DB (example: by Facebook ID)
    let user = await User.findOne({ facebookId: fbUser.id });
    if (!user) {
      user = new User({
        username: fbUser.name,
        email: fbUser.email,
        facebookId: fbUser.id,
        facebookAccessToken: accessToken,
      });
    } else {
      user.facebookAccessToken = accessToken;
    }
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
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/social-accounts';
      const params = new URLSearchParams({
        success: 'true',
        platform: 'facebook',
        username: user.username || '',
        token,
      });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
  } catch (err) {
      console.error('Facebook OAuth error:', err.response?.data || err.message || err);
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000/social-accounts';
      const params = new URLSearchParams({
        error: 'facebook',
        details: err.response?.data?.error?.message || err.message || 'Facebook OAuth failed',
      });
      return res.redirect(`${frontendUrl}?${params.toString()}`);
  }
});

module.exports = router;
