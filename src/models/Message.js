const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  senderName: { type: String, required: true, trim: true, maxlength: 100 },
  senderRole: { type: String, enum: ['staff', 'patient'], default: 'staff' },
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
