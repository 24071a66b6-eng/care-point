const mongoose = require('mongoose');

const vitalSchema = new mongoose.Schema({
  heartRate: { type: Number, min: 20, max: 250 },
  respiratoryRate: { type: Number, min: 1, max: 80 },
  temperature: { type: Number, min: 25, max: 45 },
  systolic: { type: Number, min: 40, max: 300 },
  diastolic: { type: Number, min: 20, max: 200 },
  recordedAt: { type: Date, required: true }
}, { _id: true });

const patientSchema = new mongoose.Schema({
  patientNumber: { type: String, required: true, unique: true, index: true },
  firstName: { type: String, required: true, trim: true, maxlength: 60 },
  lastName: { type: String, required: true, trim: true, maxlength: 60 },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Female', 'Male', 'Non-binary', 'Unspecified'], default: 'Unspecified' },
  email: { type: String, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 30 },
  address: { type: String, trim: true, maxlength: 240 },
  insurance: {
    provider: { type: String, trim: true, maxlength: 100 },
    memberId: { type: String, trim: true, maxlength: 80 }
  },
  vitals: { type: [vitalSchema], default: [] }
}, { timestamps: true });

patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ 'vitals.recordedAt': -1 });

module.exports = mongoose.model('Patient', patientSchema);
