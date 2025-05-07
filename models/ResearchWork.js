const mongoose = require('mongoose');

const ResearchWorkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  journalName: {
    type: String,
    required: function() {
      return ['Journal', 'Conference'].includes(this.type);
    },
  },
  bookWritten: {
    type: String,
    required: function() {
      return this.type === 'Book/Chapter';
    },
  },
  editors: {
    type: String,
  },
  publicationDate: {
    type: Date,
    required: function() {
      return ['Journal', 'Conference', 'Book/Chapter'].includes(this.type);
    },
  },
  authors: {
    type: String,
  },
  volIssue: {
    type: String,
  },
  doi: {
    type: String,
  },
  snip: {
    type: String,
  },
  location: {
    type: String,
  },
  mode: {
    type: String,
    enum: ['Oral', 'Attended', 'Poster', 'Presented', ''],
    default: '',
  },
  publishedInProceeding: {
    type: Boolean,
    default: false,
  },
  invitedInTalk: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['Journal', 'Conference', 'Book/Chapter', 'Other'],
    required: true,
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

module.exports = mongoose.model('ResearchWork', ResearchWorkSchema);