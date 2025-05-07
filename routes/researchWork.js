const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const ResearchWork = require('../models/ResearchWork');
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
    const researchWorks = await ResearchWork.find({ userId: req.user.id });
    res.json(researchWorks);
  } catch (err) {
    console.error('Error fetching research works:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, journalName, bookWritten, editors, publicationDate, authors, volIssue, doi, snip, location, mode, publishedInProceeding, invitedInTalk, description, type } = req.body;

  try {
    if (!title || !type) {
      return res.status(400).json({ message: 'Title and type are required' });
    }
    if (['Journal', 'Conference'].includes(type) && (!journalName || !publicationDate)) {
      return res.status(400).json({ message: 'Journal name and publication date are required for Journal and Conference types' });
    }
    if (type === 'Book/Chapter' && (!bookWritten || !publicationDate)) {
      return res.status(400).json({ message: 'Book written and publication date are required for Book/Chapter type' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    const researchWork = new ResearchWork({
      userId: req.user.id,
      title,
      journalName,
      bookWritten,
      editors,
      publicationDate: publicationDate ? new Date(publicationDate) : undefined,
      authors,
      volIssue,
      doi,
      snip,
      location,
      mode,
      publishedInProceeding: publishedInProceeding === 'true',
      invitedInTalk: invitedInTalk === 'true',
      description: description || '',
      type,
      files: req.files.map(file => ({
        filePath: path.join('Uploads', file.filename),
        fileSize: file.size,
        fileName: file.originalname,
      })),
    });

    await researchWork.save();
    console.log('Research work created:', researchWork);
    res.status(201).json(researchWork);
  } catch (err) {
    console.error('Error creating research work:', err);
    res.status(400).json({ message: 'Error creating research work', error: err.message });
  }
});

router.put('/:id', authenticate, upload.array('files', 5), async (req, res) => {
  const { title, journalName, bookWritten, editors, publicationDate, authors, volIssue, doi, snip, location, mode, publishedInProceeding, invitedInTalk, description, type } = req.body;

  try {
    if (!title || !type) {
      return res.status(400).json({ message: 'Title and type are required' });
    }
    if (['Journal', 'Conference'].includes(type) && (!journalName || !publicationDate)) {
      return res.status(400).json({ message: 'Journal name and publication date are required for Journal and Conference types' });
    }
    if (type === 'Book/Chapter' && (!bookWritten || !publicationDate)) {
      return res.status(400).json({ message: 'Book written and publication date are required for Book/Chapter type' });
    }

    const updatedData = {
      title,
      journalName,
      bookWritten,
      editors,
      publicationDate: publicationDate ? new Date(publicationDate) : undefined,
      authors,
      volIssue,
      doi,
      snip,
      location,
      mode,
      publishedInProceeding: publishedInProceeding === 'true',
      invitedInTalk: invitedInTalk === 'true',
      description: description || '',
      type,
    };

    if (req.files && req.files.length > 0) {
      const oldResearchWork = await ResearchWork.findOne({ _id: req.params.id, userId: req.user.id });
      if (oldResearchWork) {
        for (const file of oldResearchWork.files) {
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

    const researchWork = await ResearchWork.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updatedData,
      { new: true }
    );
    if (!researchWork) return res.status(404).json({ message: 'Research work not found' });

    res.json(researchWork);
  } catch (err) {
    console.error('Error updating research work:', err);
    res.status(500).json({ message: 'Error updating research work', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const researchWork = await ResearchWork.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!researchWork) return res.status(404).json({ message: 'Research work not found' });

    for (const file of researchWork.files) {
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

    res.json({ message: 'Research work deleted successfully' });
  } catch (err) {
    console.error('Error deleting research work:', err);
    res.status(500).json({ message: 'Error deleting research work', error: err.message });
  }
});

router.get('/download/:filename', authenticate, async (req, res) => {
  try {
    const researchWork = await ResearchWork.findOne({
      userId: req.user.id,
      'files.filePath': `Uploads/${req.params.filename}`,
    });

    if (!researchWork) {
      return res.status(404).json({ message: 'File not found or unauthorized' });
    }

    const filePath = path.join(__dirname, '../Uploads', req.params.filename);
    
    // Check if file exists
    await fs.access(filePath).catch(() => {
      throw new Error('File not found');
    });

    // Find the file's original name from the research work
    const file = researchWork.files.find(f => f.filePath === `Uploads/${req.params.filename}`);
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