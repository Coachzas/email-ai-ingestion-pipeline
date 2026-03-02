const express = require('express');
const router = express.Router();
const tokenUsageController = require('../controllers/token-usage.controller');

// Token usage routes
router.get('/history', tokenUsageController);
router.get('/stats', tokenUsageController);
router.post('/cleanup', tokenUsageController);

module.exports = router;
