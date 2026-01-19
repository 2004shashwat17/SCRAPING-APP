const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ access_token: token, token_type: 'Bearer', user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('auth.register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }
    // Find user by username or email
    const user = await User.findOne({ $or: [
      username ? { username } : {},
      email ? { email } : {}
    ] });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ access_token: token, token_type: 'Bearer', user: { id: user._id, username: user.username, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ 
      id: user._id, 
      username: user.username, 
      email: user.email, 
      avatar: user.avatar,
      is_active: true,
      facebookConnected: !!user.facebookConnected,
      facebookConnectedAt: user.facebookConnectedAt ? user.facebookConnectedAt : undefined,
      facebookName: user.facebookName,
      facebookEmail: user.facebookEmail
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user avatar
exports.updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) {
      return res.status(400).json({ message: 'Avatar URL is required' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.avatar = avatar;
    await user.save();
    
    res.json({ 
      message: 'Avatar updated successfully',
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        avatar: user.avatar 
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
