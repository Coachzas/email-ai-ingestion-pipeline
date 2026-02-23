// สร้างตัวจัดการเส้นทางแบบแยกส่วน (Modular) ทำให้สามารถแบ่ง API ออกเป็นหลายๆ ไฟล์ได้ (เช่น ไฟล์จัดการเมล, ไฟล์จัดการผู้ใช้) แทนที่จะเขียนรวมกันในไฟล์เดียว
const express = require('express');
const router = express.Router();

// นำเข้าฟังก์ชันจากไฟล์ควบคุม ingest.controller.js
const { fetchEmailsPreview, saveSelectedEmails } = require('../controllers/ingest.controller');

router.post('/fetch-emails-preview', fetchEmailsPreview); //Path /fetch-emails-preview: ดึงอีเมลมาดูก่อน (ไม่บันทึก) - รวมฟังก์ชัน runFetch
router.post('/save-selected-emails', saveSelectedEmails); //Path /save-selected-emails: บันทึกอีเมลที่เลือก

// Note: OCR processing moved to ocr-progress.routes.js for centralized management
// Frontend should use: POST /api/ocr-progress/start

module.exports = router;
