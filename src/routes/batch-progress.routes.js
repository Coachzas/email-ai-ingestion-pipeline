const express = require('express');
const router = express.Router();
const { getBatchProgress } = require('../controllers/batch-progress.controller');

// SSE endpoint for batch progress (email saving + OCR)
router.get('/progress', getBatchProgress);

module.exports = router;
