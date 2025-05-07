const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const TeachingContribution = require('../models/TeachingContribution');
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
    const contributions = await TeachingContribution.find({ userId: req.user.id });
    res.json(contributions);
  } catch (err) {
    console.error('Error fetching teaching contributions:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { courseName, courseCode, studentsRegistered, institute, modeOfDelivery, description } = req.body;

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const contribution = new TeachingContribution({
      userId: req.user.id,
      courseName,
      courseCode,
      studentsRegistered: studentsRegistered ? Number(studentsRegistered) : undefined,
      institute,
      modeOfDelivery: modeOfDelivery || 'Online',
      description: description || '',
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await contribution.save();
    console.log('Teaching contribution created:', contribution);
    res.status(201).json(contribution);
  } catch (err) {
    console.error('Error creating teaching contribution:', err);
    res.status(400).json({ message: 'Error creating teaching contribution', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { courseName, courseCode, studentsRegistered, institute, modeOfDelivery, description } = req.body;

  try {
    const updatedData = {
      courseName,
      courseCode,
      studentsRegistered: studentsRegistered ? Number(studentsRegistered) : undefined,
      institute,
      modeOfDelivery: modeOfDelivery || 'Online',
      description: description || '',
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const contribution = await TeachingContribution.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!contribution) return res.status(404).json({ message: 'Teaching contribution not found' });

    res.json(contribution);
  } catch (err) {
    console.error('Error updating teaching contribution:', err);
    res.status(500).json({ message: 'Error updating teaching contribution', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const contribution = await TeachingContribution.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!contribution) return res.status(404).json({ message: 'Teaching contribution not found' });

    for (const file of contribution.files) {
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

    res.json({ message: 'Teaching contribution deleted successfully' });
  } catch (err) {
    console.error('Error deleting teaching contribution:', err);
    res.status(500).json({ message: 'Error deleting teaching contribution', error: err.message });
  }
});

// New endpoint for downloading files
router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    // Find a contribution that contains the requested file
    const contribution = await TeachingContribution.findOne({
      userId: req.user.id,
      'files.filePath': `Uploads/${req.params.filename}`,
    });

    if (!contribution) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    const filePath = path.join(__dirname, '../Uploads', req.params.filename);
    
    // Check if file exists
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });

    // Find the file's original name from the contribution
    const file = contribution.files.find(f => f.filePath === `Uploads/${req.params.filename}`);
    const originalFileName = file ? file.fileName : req.params.filename;

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Send the file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ message: 'Error downloading file' });
      }
    });
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(404).json({ message: 'File not found or unauthorized' });
  }
});

module.exports = router;