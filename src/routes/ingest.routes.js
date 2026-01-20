// สร้างตัวจัดการเส้นทางแบบแยกส่วน (Modular) ทำให้สามารถแบ่ง API ออกเป็นหลายๆ ไฟล์ได้ (เช่น ไฟล์จัดการเมล, ไฟล์จัดการผู้ใช้) แทนที่จะเขียนรวมกันในไฟล์เดียว
const express = require('express');
const router = express.Router();

// นำเข้าฟังก์ชัน runFetch จากไฟล์ควบคุม ingest.controller.js
const { runFetch } = require('../controllers/ingest.controller');
router.post('/fetch-email', runFetch); //Path /fetch-email: เมื่อมีคนเรียกมาที่ domain ของ fetch-email โค้ดจะส่งงานต่อไปให้ฟังก์ชัน runFetch

module.exports = router;
