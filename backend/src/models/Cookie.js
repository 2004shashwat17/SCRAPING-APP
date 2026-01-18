const mongoose = require('mongoose');

const CookieSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  status: { type: String, enum: ['ready','in_use','disabled'], default: 'ready' },
  assignedUntil: { type: Date, default: null },
  usageCount: { type: Number, default: 0 },
  lastError: { type: String },
  lastUsedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Cookie', CookieSchema);
