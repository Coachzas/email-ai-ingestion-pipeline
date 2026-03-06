const express = require('express');
const router = express.Router();
const batchSchedulerController = require('../controllers/batchScheduler.controller');

// GET /api/batch-runs/history - ดึงประวัติการรัน batch ทั้งหมด
router.get('/history', batchSchedulerController.getBatchHistory);

module.exports = router;
