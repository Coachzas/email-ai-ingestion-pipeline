const express = require('express');
const router = express.Router();
const { uploadFile, getUploadedFiles, deleteFile, readFileData, renameFile } = require('../controllers/file-upload.controller');
const { verifyUser } = require('../controllers/auth.controller');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (สำหรับ upload ไป Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์ CSV, XLSX และ XLS เท่านั้น'), false);
    }
  }
});

// ใช้ authentication middleware สำหรับทุก routes
router.use(verifyUser);

// อัปโหลดไฟล์ (พร้อม upload ไป Supabase Storage)
router.post('/upload', upload.single('file'), uploadFile);

// ดึงข้อมูลไฟล์ทั้งหมด (จาก Supabase Storage)
router.get('/', getUploadedFiles);

// ลบไฟล์
router.delete('/:fileId', deleteFile);

// อ่านข้อมูลจากไฟล์
router.get('/:fileId', readFileData);

// เปลี่ยนชื่อไฟล์
router.put('/:fileId', renameFile);

module.exports = router;
