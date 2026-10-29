const mongoose = require('mongoose');

const diagnosisSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['Active', 'Monitoring', 'Resolved'], default: 'Active' },
  recordedAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Diagnosis', diagnosisSchema);
