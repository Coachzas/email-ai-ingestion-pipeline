const express = require('express');
const router = express.Router();
const { 
  upload, 
  uploadFile, 
  getUploadedFiles, 
  deleteFile, 
  readFileData,
  renameFile 
} = require('../controllers/file-upload.controller');

// อัปโหลดไฟล์ CSV/Excel
router.post('/upload', upload.single('file'), uploadFile);

// ดึงข้อมูลไฟล์ทั้งหมด
router.get('/files', getUploadedFiles);

// ลบไฟล์
router.delete('/files/:fileName', deleteFile);

// เปลี่ยนชื่อไฟล์
router.put('/files/:fileName/rename', renameFile);

// อ่านข้อมูลจากไฟล์
router.get('/files/:fileName/read', readFileData);

module.exports = router;
