const express = require('express');
const router = express.Router();
const { getEmailProgress } = require('../controllers/email-progress.controller');

// SSE endpoint for email progress
router.get('/progress', getEmailProgress);

module.exports = router;
