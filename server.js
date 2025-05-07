const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require('path');
const fs = require('fs').promises;
const authenticate = require('./middleware/authenticate');
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());

// Ensure Uploads directory exists
const uploadsDir = path.join(__dirname, 'Uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(err => {
  console.error('Error creating Uploads directory:', err);
});

app.use('/uploads', express.static(uploadsDir));

// Public routes (e.g., user registration and login do not require authentication)
app.use('/api/users', require('./routes/users'));

// Protected routes (require authentication)
app.use('/api/documents', authenticate, require('./routes/documents'));
app.use('/api/awards', authenticate, require('./routes/awards'));
app.use('/api/teaching-contributions', authenticate, require('./routes/teachingContributions'));
app.use('/api/patents', authenticate, require('./routes/patents'));
app.use('/api/reviews', authenticate, require('./routes/reviews'));
app.use('/api/experiences', authenticate, require('./routes/experiences'));
app.use('/api/workshops', authenticate, require('./routes/workshops'));
app.use('/api/research-work', authenticate, require('./routes/researchWork'));
app.use('/api/talks', authenticate, require('./routes/talk'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));