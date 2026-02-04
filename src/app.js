const express = require('express');
const cors = require('cors');
const app = express();

const ingestRoutes = require('./routes/ingest.routes');
const ocrRoutes = require('./routes/ocr.routes');

const path = require('path');

// serve UI
app.use(express.static(path.join(__dirname, '../UI')));

// middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// IMAP routes
app.use('/api/ingest', ingestRoutes);
// OCR routes
app.use('/api/ocr', ocrRoutes);

// default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../UI/index.html'));
});

module.exports = app;
