const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  jobId: { type: String, index: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fbid: { type: String },
  status: { type: String, enum: ['queued','running','completed','failed','cancelled'], default: 'queued' },
  containerName: { type: String },
  outputPath: { type: String },
  logs: { type: Array, default: [] },
  exitCode: { type: Number },
  attempts: { type: Number, default: 0 },
  error: { type: String },
  startedAt: Date,
  finishedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Job', JobSchema);
