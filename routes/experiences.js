const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Experience = require('../models/Experience');
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
    const experiences = await Experience.find({ userId: req.user.id });
    res.json(experiences);
  } catch (err) {
    console.error('Error fetching experiences:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  // Extract fields from request - only roleTitle is truly required
  const { 
    roleTitle, 
    institutionName, 
    authorDetails,
    presentCountry,
    onlineLink,
    description,
    startDate, 
    endDate 
  } = req.body;

  try {
    // Validate required field
    if (!roleTitle) {
      return res.status(400).json({ message: 'Title (Role Title) is required' });
    }
    
    // Ensure at least one file is provided
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    // Create experience with all fields from UI
    const experience = new Experience({
      userId: req.user.id,
      roleTitle,
      institutionName: institutionName || 'Default Institution',
      authorDetails,
      presentCountry,
      onlineLink,
      description: description || '',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await experience.save();
    console.log('Experience created:', experience);
    res.status(201).json(experience);
  } catch (err) {
    console.error('Error creating experience:', err);
    res.status(400).json({ message: 'Error creating experience', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  // Extract fields from request - only roleTitle is truly required
  const { 
    roleTitle, 
    institutionName, 
    authorDetails,
    presentCountry,
    onlineLink,
    description,
    startDate, 
    endDate 
  } = req.body;

  try {
    // Validate required field
    if (!roleTitle) {
      return res.status(400).json({ message: 'Title (Role Title) is required' });
    }

    // Prepare data to update
    const updatedData = {
      roleTitle,
      institutionName: institutionName || 'Default Institution',
      authorDetails,
      presentCountry,
      onlineLink,
      description: description || '',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
    };

    // If new files are uploaded, update files array
    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    // Find and update the experience
    const experience = await Experience.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    
    // Handle not found case
    if (!experience) return res.status(404).json({ message: 'Experience not found' });

    res.json(experience);
  } catch (err) {
    console.error('Error updating experience:', err);
    res.status(500).json({ message: 'Error updating experience', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Find and delete the experience
    const experience = await Experience.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    // Handle not found case
    if (!experience) return res.status(404).json({ message: 'Experience not found' });

    // Delete associated files
    for (const file of experience.files) {
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

    res.json({ message: 'Experience deleted successfully' });
  } catch (err) {
    console.error('Error deleting experience:', err);
    res.status(500).json({ message: 'Error deleting experience', error: err.message });
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