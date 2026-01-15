const User = require('../models/User');

exports.createConsent = async (req, res) => {
  try {
    const { platforms, agreedToTerms, metadata } = req.body;
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const consent = {
      username: user.username || user.email,
      platforms: Array.isArray(platforms) ? platforms : [],
      agreedToTerms: Boolean(agreedToTerms),
      metadata: metadata || {},
    };

    user.consents = user.consents || [];
    user.consents.push(consent);
    await user.save();

    // return the newly created consent (last element)
    const created = user.consents[user.consents.length - 1];
    res.json({ message: 'Consent recorded', consent: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getConsentsForUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const consents = (user.consents || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ consents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
