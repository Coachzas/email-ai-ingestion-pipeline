const path = require('path');

/**
 * จัดการโครงสร้างโฟล์เดอร์ชั่วคราวสำหรับ OCR
 */
class TempPathManager {
  constructor() {
    this.baseTempDir = './temp';
    
    // กำหนดโฟล์เดอร์ย่อยตามประเภท
    this.paths = {
      base: this.baseTempDir,
      pdf: path.join(this.baseTempDir, 'pdf'),
      image: path.join(this.baseTempDir, 'image'), 
      upload: path.join(this.baseTempDir, 'upload')
    };
    
    this.ensureDirectories();
  }

  /**
   * สร้างโฟล์เดอร์ที่จำเป็นต้องการ
   */
  ensureDirectories() {
    this.cleanupAll();
    
    Object.values(this.paths).forEach(dirPath => {
      if (!require('fs').existsSync(dirPath)) {
        require('fs').mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * ดึง path สำหรับ PDF conversion
   */
  getPdfPath(filename = '') {
    return filename ? path.join(this.paths.pdf, filename) : this.paths.pdf;
  }

  /**
   * ดึง path สำหรับ Image preprocessing
   */
  getImagePath(filename = '') {
    return filename ? path.join(this.paths.image, filename) : this.paths.image;
  }

  /**
   * ดึง path สำหรับ Upload ชั่วคราว
   */
  getUploadPath(filename = '') {
    return filename ? path.join(this.paths.upload, filename) : this.paths.upload;
  }

  /**
   * ลบไฟล์ทั้งหมดใน temp directory
   */
  cleanupAll() {
    const fs = require('fs');
    try {
      if (fs.existsSync(this.baseTempDir)) {
        this.deleteDirectory(this.baseTempDir);
      }
    } catch (error) {
      console.warn('⚠️ Cleanup error:', error.message);
    }
  }

  /**
   * ลบไฟล์ตามประเภท
   */
  cleanupByType(type) {
    const fs = require('fs');
    const validTypes = ['pdf', 'image', 'upload'];
    
    if (!validTypes.includes(type)) {
      return;
    }

    try {
      const dirPath = this.paths[type];
      if (fs.existsSync(dirPath)) {
        this.deleteDirectory(dirPath);
      }
    } catch (error) {
      console.warn(`⚠️ ${type} cleanup error:`, error.message);
    }
  }

  /**
   * ลบไฟล์ที่เก่ากว่าที่กำหนด (default: 1 วัน)
   */
  cleanupOldFiles(maxAgeDays = 1) {
    const fs = require('fs');
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    try {
      if (fs.existsSync(this.baseTempDir)) {
        const files = fs.readdirSync(this.baseTempDir, { withFileTypes: true });
        
        files.forEach(file => {
          const filePath = path.join(this.baseTempDir, file.name);
          
          if (file.isFile()) {
            const stats = fs.statSync(filePath);
            const age = now - stats.mtime.getTime();
            
            if (age > maxAge) {
              fs.unlinkSync(filePath);
            }
          }
        });
      }
      
      Object.values(this.paths).forEach(dirPath => {
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          
          files.forEach(file => {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtime.getTime();
            
            if (age > maxAge) {
              fs.unlinkSync(filePath);
            }
          });
        }
      });
    } catch (error) {
      console.warn('⚠️ Old files cleanup error:', error.message);
    }
  }

  /**
   * ลบโฟล์เดอร์และเนื้อหาใน
   */
  deleteDirectory(dirPath) {
    const fs = require('fs');
    
    if (!fs.existsSync(dirPath)) return;
    
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        this.deleteDirectory(filePath); // Recursive
      } else {
        fs.unlinkSync(filePath);
      }
    });
  }
}

// Singleton instance
const tempPathManager = new TempPathManager();

module.exports = tempPathManager;
