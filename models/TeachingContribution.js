const mongoose = require('mongoose');

const TeachingContributionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseName: {
    type: String,
    required: false,
  },
  courseCode: {
    type: String,
  },
  studentsRegistered: {
    type: Number,
  },
  institute: {
    type: String,
  },
  modeOfDelivery: {
    type: String,
    enum: ['Online', 'Offline'],
    default: 'Online',
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

module.exports = mongoose.model('TeachingContribution', TeachingContributionSchema);