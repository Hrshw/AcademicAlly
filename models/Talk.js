const mongoose = require('mongoose');

const TalkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: false,
  },
  talkEventName: {
    type: String,
  },
  talkPanelist: {
    type: String,
  },
  presentCountry: {
    type: String,
  },
  description: {
    type: String,
    default: '',
  },
  talkDate: {
    type: Date,
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

module.exports = mongoose.model('Talk', TalkSchema);