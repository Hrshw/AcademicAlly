const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Review = require('../models/Review');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../Uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'audio/mpeg',           // MP3 files
      'audio/wav',            // WAV files
      'audio/ogg',            // OGG audio
      'audio/aac',            // AAC audio
      'audio/webm',           // WebM audio
      'audio/mp4',            // MP4 audio
      'audio/x-m4a',          // M4A audio (Apple)
      'audio/flac',           // FLAC files
      'audio/x-ms-wma',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG allowed.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', authenticate, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user.id });
    res.json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { reviewerName, reviewType, dateReviewed, description } = req.body;

  try {
    if (!reviewerName || !reviewType) {
      return res.status(400).json({ message: 'Reviewer name and review type are required' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const review = new Review({
      userId: req.user.id,
      reviewerName,
      reviewType,
      dateReviewed: dateReviewed ? new Date(dateReviewed) : undefined,
      description: description || '',
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await review.save();
    console.log('Review created:', review);
    res.status(201).json(review);
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(400).json({ message: 'Error creating review', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { reviewerName, reviewType, dateReviewed, description } = req.body;

  try {
    if (!reviewerName || !reviewType) {
      return res.status(400).json({ message: 'Reviewer name and review type are required' });
    }

    const updatedData = {
      reviewerName,
      reviewType,
      dateReviewed: dateReviewed ? new Date(dateReviewed) : undefined,
      description: description || '',
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!review) return res.status(404).json({ message: 'Review not found' });

    res.json(review);
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ message: 'Error updating review', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!review) return res.status(404).json({ message: 'Review not found' });

    for (const file of review.files) {
      try {
        await fs.access(file.filePath);
        await fs.unlink(file.filePath);
        console.log(`Deleted file: ${file.filePath}`);
      } catch (err) {
        if (err.code === 'ENOENT') {
          console.warn(`File not found, skipping: ${file.filePath}`);
        } else {
          console.error(`Error deleting file ${file.filePath}:`, err);
        }
      }
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ message: 'Error deleting review', error: err.message });
  }
});

router.get('/download/:filename', authenticate, async (req, res) => {
  const filePath = path.join(__dirname, '../Uploads', req.params.filename);
  try {
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });
    res.download(filePath);
  } catch (err) {
    console.error('Error sending file:', err);
    res.status(500).json({ message: 'Error sending file', error: err.message });
  }
});

module.exports = router;