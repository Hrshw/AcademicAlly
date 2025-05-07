const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Award = require('../models/Award');
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
    const awards = await Award.find({ userId: req.user.id });
    res.json(awards);
  } catch (err) {
    console.error('Error fetching awards:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description, dateReceived } = req.body;

  try {
    // if (!title) {
    //   return res.status(400).json({ message: 'Title is required' });
    // }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const award = new Award({
      userId: req.user.id,
      title,
      description: description || '',
      dateReceived: dateReceived ? new Date(dateReceived) : undefined,
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await award.save();
    console.log('Award created:', award);
    res.status(201).json(award);
  } catch (err) {
    console.error('Error creating award:', err);
    res.status(400).json({ message: 'Error creating award', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description, dateReceived } = req.body;

  try {
    // if (!title) {
    //   return res.status(400).json({ message: 'Title is required' });
    // }

    const updatedData = {
      title,
      description: description || '',
      dateReceived: dateReceived ? new Date(dateReceived) : undefined,
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const award = await Award.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!award) return res.status(404).json({ message: 'Award not found' });

    res.json(award);
  } catch (err) {
    console.error('Error updating award:', err);
    res.status(500).json({ message: 'Error updating award', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const award = await Award.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!award) return res.status(404).json({ message: 'Award not found' });

    for (const file of award.files) {
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

    res.json({ message: 'Award deleted successfully' });
  } catch (err) {
    console.error('Error deleting award:', err);
    res.status(500).json({ message: 'Error deleting award', error: err.message });
  }
});

router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    // Find an award that contains the requested file
    const award = await Award.findOne({
      userId: req.user.id,
      'files.filePath': `Uploads/${req.params.filename}`,
    });  

    if (!award) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    const filePath = path.join(__dirname, '../Uploads', req.params.filename);
    
    // Check if file exists
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });

    // Find the file's original name from the award
    const file = award.files.find(f => f.filePath === `Uploads/${req.params.filename}`);
    const originalFileName = file ? file.fileName : req.params.filename;

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Send the file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ message: 'Error sending file', error: err.message });
      }
    });
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ message: 'Error downloading file', error: err.message });
  }
});

module.exports = router;