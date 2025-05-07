const mongoose = require('mongoose');

const ExperienceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Required field - maps to "Title" in UI
  roleTitle: {
    type: String,
    required: false,
  },
  // Maps to "Periodical Name" in UI
  institutionName: {
    type: String,
    default: 'Default Institution',
  },
  // Maps to "Author Details" in UI
  authorDetails: {
    type: String,
  },
  // Maps to "Country/State" in UI
  presentCountry: {
    type: String,
  },
  // Maps to "Online Link" in UI
  onlineLink: {
    type: String,
  },
  // Maps to "Description" in UI
  description: {
    type: String,
    default: '',
  },
  // Maps to "Time" in UI - Date fields
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
  // Files/attachments
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

module.exports = mongoose.model('Experience', ExperienceSchema);