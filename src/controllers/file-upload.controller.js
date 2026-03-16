const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../utils/prisma');
const storageService = require('../services/storage.service');
const { verifyUser } = require('../controllers/auth.controller');

// Configure multer for memory storage (สำหรับ upload ตรงไป Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// อัปโหลดไฟล์ CSV/Excel และอัปโหลดไป Supabase Storage
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณาเลือกไฟล์ที่จะอัปโหลด' 
      });
    }

    // ตรวจสอบ user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const userId = req.user.id;

    // อ่านข้อมูลจากไฟล์ใน memory
    let data;
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถอ่านข้อมูลจากไฟล์ได้: ' + parseError.message
      });
    }

    // ตรวจสอบว่ามีข้อมูลในไฟล์หรือไม่
    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไฟล์ไม่มีข้อมูล'
      });
    }

    // อัปโหลดไฟล์ไป Supabase Storage
    let cloudUploadResult;
    try {
      cloudUploadResult = await storageService.uploadFile(
        fileName, 
        fileName, 
        userId, 
        req.file.mimetype,
        req.file.buffer // ใช้ buffer แทน filePath
      );
      console.log(`✅ File uploaded to Supabase: ${cloudUploadResult.path}`);
    } catch (uploadError) {
      console.error('Supabase upload error:', uploadError);
      // ถ้า upload ล้มเหลว ใช้ local path แทน
      cloudUploadResult = {
        path: fileName,
        publicUrl: null,
        size: fileSize
      };
    }

    // สร้างข้อมูลสำหรับ response
    const fileInfo = {
      id: Date.now().toString(),
      fileName,
      filePath: cloudUploadResult.path, // ใช้ cloud path ถ้าสำเร็จ
      cloudPath: cloudUploadResult.path,
      publicUrl: cloudUploadResult.publicUrl,
      fileSize,
      uploadDate: new Date().toISOString(),
      rowCount: data.length,
      columns: Object.keys(data[0]),
      preview: data.slice(0, 5),
      cloudProvider: cloudUploadResult.publicUrl ? 'supabase' : 'local'
    };

    // ลบ temp file ถ้ามี (ไม่ต้องการเพราะใช้ memory storage)
    // if (fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);
    // }

    res.json({
      success: true,
      message: 'อัปโหลดไฟล์สำเร็จ',
      data: fileInfo
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // ไม่ต้องลบ temp file เพราะใช้ memory storage
    // if (req.file && req.file.path) {
    //   fs.unlinkSync(req.file.path);
    // }

    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + error.message
    });
  }
};

// ดึงข้อมูลไฟล์ทั้งหมด (อัปเดตให้รองรับ cloud storage)
const getUploadedFiles = async (req, res) => {
  try {
    // ตรวจสอบ user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;

    // ดึงข้อมูลจาก Supabase Storage ผ่าน database
    const files = await prisma.attachment.findMany({
      where: { 
        userId: userId,
        cloudProvider: { not: null } // แสดงเฉพาะไฟล์ที่อัปโหลดไป cloud
      },
      select: {
        id: true,
        fileName: true,
        cloudPath: true,
        publicUrl: true,
        size: true,
        createdAt: true,
        cloudProvider: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // แปลงข้อมูลให้เข้ากับรูปแบบเดิม
    const formattedFiles = files.map(file => ({
      id: file.id,
      fileName: file.fileName,
      filePath: file.cloudPath || file.filePath, // ใช้ cloud path ถ้ามี
      fileSize: file.size,
      uploadDate: file.createdAt,
      publicUrl: file.publicUrl,
      cloudProvider: file.cloudProvider
    }));

    res.json({
      success: true,
      data: formattedFiles
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์: ' + error.message
    });
  }
};

// ลบไฟล์จาก Supabase Storage
const deleteFile = async (req, res) => {
  try {
    // ตรวจสอบ user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const userId = req.user.id;

    // ค้นหาไฟล์ใน database
    const file = await prisma.attachment.findFirst({
      where: {
        id: fileId,
        userId: userId
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์ที่ต้องการลบ'
      });
    }

    // ลบไฟล์จาก Supabase Storage
    if (file.cloudPath) {
      try {
        await storageService.deleteFile(file.cloudPath);
      } catch (deleteError) {
        console.error('Failed to delete from Supabase:', deleteError);
        // ดำเนินการต่อ即使 storage deletion fails
      }
    }

    // ลบข้อมูลจาก database
    await prisma.attachment.delete({
      where: { id: fileId }
    });

    res.json({
      success: true,
      message: 'ลบไฟล์สำเร็จ'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message
    });
  }
};

// อ่านข้อมูลจากไฟล์จาก Supabase Storage
const readFileData = async (req, res) => {
  try {
    // ตรวจสอบ user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const userId = req.user.id;

    // ค้นหาไฟล์ใน database
    const file = await prisma.attachment.findFirst({
      where: {
        id: fileId,
        userId: userId
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์'
      });
    }

    // ดาวน์โหลดไฟล์จาก Supabase Storage
    let tempFilePath;
    try {
      tempFilePath = path.join(__dirname, '../../temp', file.fileName);
      await storageService.downloadFile(file.cloudPath, tempFilePath);
    } catch (downloadError) {
      console.error('Failed to download from Supabase:', downloadError);
      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถดาวน์โหลดไฟล์จาก cloud storage ได้'
      });
    }

    // อ่านข้อมูลจากไฟล์
    const workbook = XLSX.readFile(tempFilePath);
    const sheetNames = workbook.SheetNames;
    
    const sheets = sheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      return {
        sheetName,
        rowCount: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        preview: data
      };
    });

    // ลบไฟล์ชั่วคราว
    fs.unlinkSync(tempFilePath);

    res.json({
      success: true,
      data: {
        fileName: file.fileName,
        sheets
      }
    });

  } catch (error) {
    console.error('Read file error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอ่านไฟล์: ' + error.message
    });
  }
};

// เปลี่ยนชื่อไฟล์ใน Supabase Storage (ไม่รองรับในปัจจุบัน)
const renameFile = async (req, res) => {
  try {
    // ตรวจสอบ user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const { newFileName } = req.body;
    const userId = req.user.id;

    if (!newFileName || newFileName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อไฟล์ใหม่'
      });
    }

    // ค้นหาไฟล์ใน database
    const file = await prisma.attachment.findFirst({
      where: {
        id: fileId,
        userId: userId
      }
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์ที่ต้องการเปลี่ยนชื่อ'
      });
    }

    // Supabase Storage ไม่รองรับการเปลี่ยนชื่อไฟล์โดยตรง
    // ต้องอัปโหลดไฟล์ใหม่และลบไฟล์เก่า แต่เพื่อความง่ายจะอัปเดตเฉพาะใน database
    await prisma.attachment.update({
      where: { id: fileId },
      data: { fileName: newFileName }
    });

    res.json({
      success: true,
      message: 'เปลี่ยนชื่อไฟล์สำเร็จ (อัปเดตใน database)'
    });

  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์: ' + error.message
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  getUploadedFiles,
  deleteFile,
  readFileData,
  renameFile
};
