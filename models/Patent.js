const mongoose = require('mongoose');

const PatentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  patentNumber: {
    type: String,
    required: true,
  },
  dateFiled: {
    type: Date,
  },
  status: {
    type: String,
  },
  files: [
    {
      filePath: { type: String, required: true },
      fileSize: { type: Number, required: true },
      fileName: { type: String, required: true },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Patent', PatentSchema);