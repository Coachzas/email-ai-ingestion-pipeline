const express = require('express');
const router = express.Router();
const tokenUsageLogger = require('../utils/token-usage-logger');

/**
 * Get token usage history
 */
router.get('/history', (req, res) => {
  try {
    const period = req.query.period || 'all';
    const history = tokenUsageLogger.getUsageHistory(period);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get token usage statistics
 */
router.get('/stats', (req, res) => {
  try {
    const period = req.query.period || 'all';
    const stats = tokenUsageLogger.getUsageStats(period);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * Clean up old logs
 */
router.post('/cleanup', (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30;
    tokenUsageLogger.cleanupOldLogs(days);
    
    res.json({
      success: true,
      message: `Cleaned up logs older than ${days} days`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
