const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Workshop = require('../models/Workshop');
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
    const workshops = await Workshop.find({ userId: req.user.id });
    res.json(workshops);
  } catch (err) {
    console.error('Error fetching workshops:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description, dateConducted, venue } = req.body;

  try {
    if (!title || !dateConducted) {
      return res.status(400).json({ message: 'Title and date conducted are required' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const workshop = new Workshop({
      userId: req.user.id,
      title,
      description: description || '',
      dateConducted: new Date(dateConducted),
      venue: venue || '',
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await workshop.save();
    console.log('Workshop created:', workshop);
    res.status(201).json(workshop);
  } catch (err) {
    console.error('Error creating workshop:', err);
    res.status(400).json({ message: 'Error creating workshop', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description, dateConducted, venue } = req.body;

  try {
    if (!title || !dateConducted) {
      return res.status(400).json({ message: 'Title and date conducted are required' });
    }

    const updatedData = {
      title,
      description: description || '',
      dateConducted: new Date(dateConducted),
      venue: venue || '',
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const workshop = await Workshop.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!workshop) return res.status(404).json({ message: 'Workshop not found' });

    res.json(workshop);
  } catch (err) {
    console.error('Error updating workshop:', err);
    res.status(500).json({ message: 'Error updating workshop', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const workshop = await Workshop.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!workshop) return res.status(404).json({ message: 'Workshop not found' });

    for (const file of workshop.files) {
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

    res.json({ message: 'Workshop deleted successfully' });
  } catch (err) {
    console.error('Error deleting workshop:', err);
    res.status(500).json({ message: 'Error deleting workshop', error: err.message });
  }
});

router.get('/download/:filename', authenticate, async (req, res) => {
  const filePath = path.join(__dirname, '../Uploads', req.params.filename);
  try {
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ message: 'Error sending file', error: err.message });
      }
    });
  } catch (err) {
    console.error('Error accessing file:', err);
    res.status(500).json({ message: 'Error accessing file', error: err.message });
  }
});

module.exports = router;