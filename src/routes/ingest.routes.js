
const express = require('express');
const router = express.Router();

// นำเข้าฟังก์ชันจากไฟล์ควบคุม ingest.controller.js
const { fetchEmailsPreview, saveSelectedEmails } = require('../controllers/ingest.controller');

router.post('/fetch-emails-preview', fetchEmailsPreview); //Path /fetch-emails-preview: ดึงอีเมลมาดูก่อน (ไม่บันทึก) 

router.post('/save-selected-emails', saveSelectedEmails); //Path /save-selected-emails: บันทึกอีเมลที่เลือก

module.exports = router;
