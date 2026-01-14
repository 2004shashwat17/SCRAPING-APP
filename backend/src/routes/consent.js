const express = require('express');
const router = express.Router();
const consentController = require('../controllers/consentController');
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token (duplicate of auth.js — could be refactored)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

router.post('/', authenticateToken, consentController.createConsent);
router.get('/', authenticateToken, consentController.getConsentsForUser);

module.exports = router;
