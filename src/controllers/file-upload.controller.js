const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// ตั้งค่า Multer สำหรับอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../storage/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
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
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// อัปโหลดไฟล์ CSV/Excel
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'กรุณาเลือกไฟล์ที่จะอัปโหลด' 
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;

    // อ่านข้อมูลจากไฟล์
    let data;
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } catch (parseError) {
      // ลบไฟล์ที่อัปโหลดถ้า parse ไม่ได้
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถอ่านข้อมูลจากไฟล์ได้: ' + parseError.message
      });
    }

    // ตรวจสอบว่ามีข้อมูลในไฟล์หรือไม่
    if (!data || data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'ไฟล์ไม่มีข้อมูล'
      });
    }

    // สร้างข้อมูลสำหรับ response
    const fileInfo = {
      id: Date.now().toString(),
      fileName,
      filePath,
      fileSize,
      uploadDate: new Date().toISOString(),
      rowCount: data.length,
      columns: Object.keys(data[0]),
      preview: data.slice(0, 5) // แสดง 5 แถวแรก
    };

    res.json({
      success: true,
      message: 'อัปโหลดไฟล์สำเร็จ',
      data: fileInfo
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    // ลบไฟล์ถ้ามี error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + error.message
    });
  }
};

// ดึงข้อมูลไฟล์ทั้งหมด
const getUploadedFiles = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../../storage/uploads');
    
    if (!fs.existsSync(uploadDir)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const files = fs.readdirSync(uploadDir)
      .filter(file => file.endsWith('.csv') || file.endsWith('.xlsx') || file.endsWith('.xls'))
      .map(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          fileName: file,
          filePath: `/storage/uploads/${file}`,
          fileSize: stats.size,
          uploadDate: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์: ' + error.message
    });
  }
};

// ลบไฟล์
const deleteFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../storage/uploads', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์ที่ต้องการลบ'
      });
    }

    fs.unlinkSync(filePath);

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

// อ่านข้อมูลจากไฟล์
const readFileData = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../storage/uploads', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์'
      });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    const sheets = sheetNames.map(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      return {
        sheetName,
        rowCount: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        preview: data // ส่งข้อมูลทั้งหมด
      };
    });

    res.json({
      success: true,
      data: {
        fileName,
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

// เปลี่ยนชื่อไฟล์
const renameFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    const { newFileName } = req.body;

    if (!newFileName || newFileName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อไฟล์ใหม่'
      });
    }

    const oldFilePath = path.join(__dirname, '../../storage/uploads', fileName);
    const newFilePath = path.join(__dirname, '../../storage/uploads', newFileName);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบไฟล์ที่ต้องการเปลี่ยนชื่อ'
      });
    }

    if (fs.existsSync(newFilePath)) {
      return res.status(400).json({
        success: false,
        message: 'ชื่อไฟล์ใหม่นี้มีอยู่แล้ว'
      });
    }

    fs.renameSync(oldFilePath, newFilePath);

    res.json({
      success: true,
      message: 'เปลี่ยนชื่อไฟล์สำเร็จ'
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
