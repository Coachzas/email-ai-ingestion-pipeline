const express = require('express');
const router = express.Router();
const { getOcrProgress, startOcrWithProgress } = require('../controllers/ocr-progress.controller');
// Start OCR with progress tracking
router.post('/start', startOcrWithProgress);

// SSE endpoint for real-time progress updates
router.get('/progress', getOcrProgress);

module.exports = router;
