const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  teamMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
  scheduledAt: { type: Date, required: true, index: true },
  type: { type: String, required: true, trim: true, maxlength: 100 },
  status: { type: String, enum: ['Scheduled', 'Checked in', 'Completed', 'Cancelled'], default: 'Scheduled' },
  notes: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

appointmentSchema.index({ teamMember: 1, scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
