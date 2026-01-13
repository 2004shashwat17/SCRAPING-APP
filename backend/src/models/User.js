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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
