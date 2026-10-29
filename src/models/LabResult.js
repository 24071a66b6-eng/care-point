const mongoose = require('mongoose');

const labResultSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  testName: { type: String, required: true, trim: true, maxlength: 140 },
  resultValue: { type: String, required: true, trim: true, maxlength: 80 },
  unit: { type: String, trim: true, maxlength: 40 },
  referenceRange: { type: String, trim: true, maxlength: 80 },
  status: { type: String, enum: ['In range', 'Review', 'Pending'], default: 'In range' },
  recordedAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('LabResult', labResultSchema);
