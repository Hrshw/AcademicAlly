const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
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
    const documents = await Document.find({ userId: req.user.id });
    res.json(documents);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description } = req.body;

  try {
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const document = new Document({
      userId: req.user.id,
      title,
      description: description || '',
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await document.save();
    console.log('Document created:', document);
    res.status(201).json(document);
  } catch (err) {
    console.error('Error creating document:', err);
    res.status(400).json({ message: 'Error creating document', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, description } = req.body;

  try {
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const updatedData = {
      title,
      description: description || '',
    };

    if (req.files && req.files.length > 0) {
      updatedData.files = req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      }));
    }

    const document = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!document) return res.status(404).json({ message: 'Document not found' });

    res.json(document);
  } catch (err) {
    console.error('Error updating document:', err);
    res.status(500).json({ message: 'Error updating document', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const document = await Document.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!document) return res.status(404).json({ message: 'Document not found' });

    for (const file of document.files) {
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

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ message: 'Error deleting document', error: err.message });
  }
});

router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    // Find a document that contains the requested file
    const document = await Document.findOne({
      userId: req.user.id,
      'files.filePath': `Uploads/${req.params.filename}`,
    });

    if (!document) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    const filePath = path.join(__dirname, '../Uploads', req.params.filename);
    
    // Check if file exists
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });

    // Find the file's original name from the document
    const file = document.files.find(f => f.filePath === `Uploads/${req.params.filename}`);
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