const express = require('express');
const cors = require('cors');
const ingestRoutes = require('./routes/ingest.routes');

const app = express();

// middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// health check
app.get('/', (req, res) => {
  res.send('API is running');
});

// IMAP routes
app.use('/api/ingest', ingestRoutes);

module.exports = app;
