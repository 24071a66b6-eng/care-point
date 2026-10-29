const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  specialty: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 30 },
  status: { type: String, enum: ['Available', 'In clinic', 'Away'], default: 'Available' }
}, { timestamps: true });

teamMemberSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
