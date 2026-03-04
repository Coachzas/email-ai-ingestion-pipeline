const express = require('express');
const router = express.Router();
const batchSchedulerController = require('../controllers/batchScheduler.controller');

// POST /api/batch-schedulers - สร้าง scheduler ใหม่
router.post('/', batchSchedulerController.createScheduler);

// GET /api/batch-schedulers - ดึง schedulers ทั้งหมด
router.get('/', batchSchedulerController.getAllSchedulers);

// GET /api/batch-schedulers/status - ตรวจสอบสถานะ batch ทั้งหมด
router.get('/status', batchSchedulerController.getBatchStatus);

// POST /api/batch-schedulers/test-imap - ทดสอบการเชื่อมต่อ IMAP
router.post('/test-imap', batchSchedulerController.testImapConnection);

// POST /api/batch-schedulers/:id/run-now - สั่งรัน scheduler ทันที
router.post('/:id/run-now', batchSchedulerController.runSchedulerNow);

// DELETE /api/batch-schedulers/:id - ลบ scheduler
router.delete('/:id', batchSchedulerController.deleteScheduler);

module.exports = router;
