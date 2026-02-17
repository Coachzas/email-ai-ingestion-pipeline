// สร้างตัวจัดการเส้นทางแบบแยกส่วน (Modular) ทำให้สามารถแบ่ง API ออกเป็นหลายๆ ไฟล์ได้ (เช่น ไฟล์จัดการเมล, ไฟล์จัดการผู้ใช้) แทนที่จะเขียนรวมกันในไฟล์เดียว
const express = require('express');
const router = express.Router();

// นำเข้าฟังก์ชัน runFetch จากไฟล์ควบคุม ingest.controller.js
const { runFetch, getEmailSummary, fetchEmailsPreview, saveSelectedEmails, processAttachmentsOCR } = require('../controllers/ingest.controller');
router.post('/fetch-email', runFetch); //Path /fetch-email: เมื่อมีคนเรียกมาที่ domain ของ fetch-email โค้ดจะส่งงานต่อไปให้ฟังก์ชัน runFetch
router.get('/email-summary', getEmailSummary); //Path /email-summary: ดูสรุปข้อมูลอีเมล
router.post('/fetch-emails-preview', fetchEmailsPreview); //Path /fetch-emails-preview: ดึงอีเมลมาดูก่อน (ไม่บันทึก)
router.post('/save-selected-emails', saveSelectedEmails); //Path /save-selected-emails: บันทึกอีเมลที่เลือก
router.post('/process-ocr', processAttachmentsOCR); //Path /process-ocr: ทำ OCR processing สำหรับ attachments (ใช้ processAttachmentsOCRController)

module.exports = router;
