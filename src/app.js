const express = require('express');
const cors = require('cors');
const app = express();

const ingestRoutes = require('./routes/ingest.routes');
const ocrRoutes = require('./routes/ocr.routes');

// middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// health check
app.get('/', (req, res) => {
  res.send('API is running');
});

// IMAP routes
app.use('/api/ingest', ingestRoutes);
// OCR routes
app.use('/api/ocr', ocrRoutes);

module.exports = app;
