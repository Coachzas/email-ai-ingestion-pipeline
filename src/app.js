const express = require('express');
const cors = require('cors');
const app = express();

const reviewRoutes = require('./routes/review.routes');
const batchProgressRoutes = require('./routes/batch-progress.routes');
const accountRoutes = require('./routes/account.routes');
const tokenUsageRoutes = require('./routes/token-usage.routes');
const batchSchedulerRoutes = require('./routes/batchScheduler.routes');
const batchRunsRoutes = require('./routes/batch-runs.routes');
const fileUploadRoutes = require('./routes/file-upload.routes');
// Note: Removed legacy email.routes - not used in current system
// Note: Removed ingest.routes - manual ingest system removed

const path = require('path');

// serve UI
app.use(express.static(path.join(__dirname, '../UI')));
// serve uploaded files
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// Review routes
app.use('/api/review', reviewRoutes);
// Batch Progress routes (unified email + OCR progress)
app.use('/api/batch-progress', batchProgressRoutes);
// Account routes
app.use('/api/accounts', accountRoutes);
// Token Usage routes
app.use('/api/token-usage', tokenUsageRoutes);
// Batch Scheduler routes
app.use('/api/batch-schedulers', batchSchedulerRoutes);
// Batch Runs routes
app.use('/api/batch-runs', batchRunsRoutes);
// File Upload routes
app.use('/api/file-upload', fileUploadRoutes);

// default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../UI/index.html'));
});

module.exports = app;
