const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
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

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getCurrentUser);
router.put('/avatar', authenticateToken, authController.updateAvatar);

module.exports = router;
