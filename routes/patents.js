const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Patent = require('../models/Patent');
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
    const patents = await Patent.find({ userId: req.user.id });
    res.json(patents);
  } catch (err) {
    console.error('Error fetching patents:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, patentNumber, dateFiled, status } = req.body;

  try {
    if (!title || !patentNumber) {
      return res.status(400).json({ message: 'Title and patent number are required' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const patent = new Patent({
      userId: req.user.id,
      title,
      patentNumber,
      dateFiled: dateFiled ? new Date(dateFiled) : undefined,
      status: status || 'Pending',
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await patent.save();
    console.log('Patent created:', patent);
    res.status(201).json(patent);
  } catch (err) {
    console.error('Error creating patent:', err);
    res.status(400).json({ message: 'Error creating patent', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, patentNumber, dateFiled, status } = req.body;

  try {
    if (!title || !patentNumber) {
      return res.status(400).json({ message: 'Title and patent number are required' });
    }

    const updatedData = {
      title,
      patentNumber,
      dateFiled: dateFiled ? new Date(dateFiled) : undefined,
      status: status || 'Pending',
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const patent = await Patent.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!patent) return res.status(404).json({ message: 'Patent not found' });

    res.json(patent);
  } catch (err) {
    console.error('Error updating patent:', err);
    res.status(500).json({ message: 'Error updating patent', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const patent = await Patent.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!patent) return res.status(404).json({ message: 'Patent not found' });

    for (const file of patent.files) {
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

    res.json({ message: 'Patent deleted successfully' });
  } catch (err) {
    console.error('Error deleting patent:', err);
    res.status(500).json({ message: 'Error deleting patent', error: err.message });
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
    console.error('Error downloading file:', err);
    res.status(500).json({ message: 'Error downloading file', error: err.message });
  }
});

module.exports = router;