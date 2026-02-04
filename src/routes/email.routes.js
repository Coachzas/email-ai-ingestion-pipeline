const express = require('express');
const router = express.Router();
const { getEmails, downloadAttachment } = require('../controllers/email.controller');

// ดึงข้อมูลอีเมลทั้งหมด
router.get('/emails', getEmails);

// ดาวน์โหลดไฟล์แนบ
router.get('/download/:id', downloadAttachment);

module.exports = router;
