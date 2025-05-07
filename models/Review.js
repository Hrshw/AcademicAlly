const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reviewerName: {
    type: String,
    required: true,
  },
  reviewType: {
    type: String,
    required: true,
  },
  dateReviewed: {
    type: Date,
  },
  description: {
    type: String,
    default: '',
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

module.exports = mongoose.model('Review', ReviewSchema);