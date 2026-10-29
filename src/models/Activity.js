const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true, maxlength: 180 },
  detail: { type: String, trim: true, maxlength: 300 },
  type: { type: String, enum: ['patient', 'appointment', 'lab', 'message', 'team'], default: 'patient' }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
