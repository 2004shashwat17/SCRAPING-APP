const mongoose = require('mongoose');

const ConsentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String },
  platforms: [{ type: String }],
  agreedToTerms: { type: Boolean, default: false },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Consent', ConsentSchema);
