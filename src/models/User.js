const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'clinician', 'staff'], default: 'admin' },
  name: { type: String, required: true, trim: true, maxlength: 100 }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
