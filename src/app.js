const express = require('express');
const cors = require('cors');
const app = express();

const ingestRoutes = require('./routes/ingest.routes');
const ocrRoutes = require('./routes/ocr.routes');
const reviewRoutes = require('./routes/review.routes');
const ocrProgressRoutes = require('./routes/ocr-progress.routes');
const emailProgressRoutes = require('./routes/email-progress.routes');
const accountRoutes = require('./routes/account.routes');
// Note: Removed legacy email.routes - not used in current system

const path = require('path');

// serve UI
app.use(express.static(path.join(__dirname, '../UI')));

// middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// IMAP routes
app.use('/api/ingest', ingestRoutes);
// OCR routes
app.use('/api/ocr', ocrRoutes);
// Review routes
app.use('/api/review', reviewRoutes);
// OCR Progress routes
app.use('/api/ocr-progress', ocrProgressRoutes);
// Email Progress routes
app.use('/api/email-progress', emailProgressRoutes);
// Account routes
app.use('/api/accounts', accountRoutes);

// default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../UI/index.html'));
});

module.exports = app;
