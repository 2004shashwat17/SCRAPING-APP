const Consent = require('../models/Consent');
const User = require('../models/User');

exports.createConsent = async (req, res) => {
  try {
    const { platforms, agreedToTerms, metadata } = req.body;
    const userId = req.userId;
    const user = await User.findById(userId).select('username email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const consent = new Consent({
      userId,
      username: user.username || user.email,
      platforms: Array.isArray(platforms) ? platforms : [],
      agreedToTerms: Boolean(agreedToTerms),
      metadata: metadata || {},
    });

    await consent.save();
    res.json({ message: 'Consent recorded', consent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getConsentsForUser = async (req, res) => {
  try {
    const userId = req.userId;
    const consents = await Consent.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({ consents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
