const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Talk = require('../models/Talk');
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
    const talks = await Talk.find({ userId: req.user.id });
    res.json(talks);
  } catch (err) {
    console.error('Error fetching talks:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { name, talkEventName, talkPanelist, presentCountry, description, talkDate } = req.body;

  try {
    // if (!name) {
    //   return res.status(400).json({ message: 'Talk name is required' });
    // }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const talk = new Talk({
      userId: req.user.id,
      name,
      talkEventName,
      talkPanelist,
      presentCountry,
      description: description || '',
      talkDate: talkDate ? new Date(talkDate) : undefined,
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await talk.save();
    console.log('Talk created:', talk);
    res.status(201).json(talk);
  } catch (err) {
    console.error('Error creating talk:', err);
    res.status(400).json({ message: 'Error creating talk', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { name, talkEventName, talkPanelist, presentCountry, description, talkDate } = req.body;

  try {
    // if (!name) {
    //   return res.status(400).json({ message: 'Talk name is required' });
    // }

    const updatedData = {
      name,
      talkEventName,
      talkPanelist,
      presentCountry,
      description: description || '',
      talkDate: talkDate ? new Date(talkDate) : undefined,
    };

    if (req.files && req.files.length > 0) {
      const oldTalk = await Talk.findOne({ _id: req.params.id, userId: req.user.id });
      if (oldTalk) {
        for (const file of oldTalk.files) {
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
      }
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const talk = await Talk.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!talk) return res.status(404).json({ message: 'Talk not found' });

    res.json(talk);
  } catch (err) {
    console.error('Error updating talk:', err);
    res.status(500).json({ message: 'Error updating talk', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const talk = await Talk.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!talk) return res.status(404).json({ message: 'Talk not found' });

    for (const file of talk.files) {
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

    res.json({ message: 'Talk deleted successfully' });
  } catch (err) {
    console.error('Error deleting talk:', err);
    res.status(500).json({ message: 'Error deleting talk', error: err.message });
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