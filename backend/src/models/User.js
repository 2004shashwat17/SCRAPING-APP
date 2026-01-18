const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Not required for OAuth-only users
  avatar: { type: String, default: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4' }, // User avatar URL
  facebookId: { type: String, sparse: true },
  facebookAccessToken: { type: String },
  facebookName: { type: String }, // Facebook profile name
  facebookEmail: { type: String }, // Facebook email
  facebookConnected: { type: Boolean, default: false },
  facebookConnectedAt: { type: Date },
  // Encrypted cookies blob and optional saved cookie file path
  facebookCookiesEncrypted: { type: Object, default: null },
  facebookCookiesPath: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  // Embedded consents (moved from separate Consent model)
  consents: [new mongoose.Schema({
    username: { type: String },
    platforms: [{ type: String }],
    agreedToTerms: { type: Boolean, default: false },
    metadata: { type: Object, default: {} },
  }, { timestamps: true })]
});

module.exports = mongoose.model('User', UserSchema);
