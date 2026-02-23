const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const tempPathManager = require('../../config/temp-paths');

/**
 * ปรับปรุงคุณภาพก่อน OCR เพื่อความแม่นยำสูงสุด
 */
class ImagePreprocessor {
  constructor() {
    this.tempDir = tempPathManager.getImagePath();
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * ประมวลผลภาพก่อน OCR
   */
  async preprocessImage(inputPath, outputFilename = null) {
    try {
      const filename = outputFilename || `preprocessed_${Date.now()}_${path.basename(inputPath)}`;
      const outputPath = path.join(this.tempDir, filename);

      const image = sharp(inputPath);
      const metadata = await image.metadata();

      // 1. แปลงเป็น grayscale
      let processedImage = image.greyscale();

      // 2. ปรับ contrast และ brightness แบบอ่อนๆ
      processedImage = processedImage
        .linear(1.1, 5) // เพิ่ม contrast 10% และ brightness 5 (ลดลงจากเดิม)
        .normalize(); // normalize histogram

      // 3. ลด noise แบบเบาๆ
      processedImage = processedImage.median(2); // ลดจาก 3 เป็น 2

      // 4. ปรับขนาด (upscale ถ้าจำเป็น)
      if (metadata.width < 2000) {
        const scale = Math.min(2.0, 2000 / metadata.width); // ลดจาก 2.5 เป็น 2.0
        processedImage = processedImage.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { 
            kernel: 'lanczos3'
          }
        );
      }

      // 5. Sharpen แบบเบาๆ
      processedImage = processedImage.sharpen({
        sigma: 0.8, // ลดจาก 1
        flat: 0.8,  // ลดจาก 1
        jagged: 1.5  // ลดจาก 2
      });

      // 6. ปรับ threshold แบบ adaptive - ใช้เฉพาะกรณีที่จำเป็น
      // ไม่ใช้ threshold แบบบังคับเพื่อรักษาสีข้อความ
      // processedImage = processedImage.threshold(128); // คอมเมนต์ไว้ก่อน

      // บันทึกภาพที่ประมวลผลแล้ว
      await processedImage
        .png({ 
          compressionLevel: 6,
          quality: 100
        })
        .toFile(outputPath);

      return outputPath;

    } catch (error) {
      return inputPath;
    }
  }

  /**
   * ประมวลผลภาพจาก buffer (สำหรับ PDF pages)
   */
  async preprocessBuffer(imageBuffer, filename = null) {
    try {
      const tempFilename = filename || `buffer_${Date.now()}.png`;
      const tempInputPath = path.join(this.tempDir, `input_${tempFilename}`);
      
      fs.writeFileSync(tempInputPath, imageBuffer);
      const processedPath = await this.preprocessImage(tempInputPath, tempFilename);
      fs.unlinkSync(tempInputPath);
      
      return fs.readFileSync(processedPath);

    } catch (error) {
      return imageBuffer;
    }
  }

  /**
   * ประมวลผลภาพแบบหลายวิธีและเลือกที่ดีที่สุด
   */
  async preprocessImageMultiple(inputPath, outputFilename = null) {
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const baseName = `multi_${timestamp}_${randomId}_${path.basename(inputPath, path.extname(inputPath))}`;
      
      // สร้างชื่อไฟล์ที่ไม่ซ้ำกันสำหรับแต่ละ method
      const outputPath1 = path.join(this.tempDir, `${baseName}_method1.png`);
      const outputPath2 = path.join(this.tempDir, `${baseName}_method2.png`);
      const outputPath3 = path.join(this.tempDir, `${baseName}_method3.png`);

      const image = sharp(inputPath);
      const metadata = await image.metadata();

      // Method 1: การปรับแต่งเบาๆ (สำหรับภาพ Digital สะอาด)
      const method1 = image
        .clone()
        .flatten({ background: '#ffffff' }) // จัดการ Alpha Channel
        .greyscale()
        .linear(1.05, 2)
        .normalize()
        // ไม่ใช้ median สำหรับภาพ digital ที่สะอาด
        .sharpen({ sigma: 0.3, flat: 0.3, jagged: 0.5 }); // ลด jagged เพื่อลด aliasing

      // Method 2: การปรับแต่งแบบ adaptive (สำหรับภาพมีเงา)
      const method2 = image
        .clone()
        .flatten({ background: '#ffffff' })
        .modulate({ 
          brightness: 1.05,
          saturation: 1.1
        })
        .greyscale()
        .normalize()
        .blur(0.3) // ใช้ blur แทน median สำหรับภาพ digital
        .sharpen({ sigma: 0.3, flat: 0.3, jagged: 0.5 });

      // Method 3: การปรับแต่งแบบ contrast เน้น (Linear Contrast Enhancement)
      const method3 = image
        .clone()
        .flatten({ background: '#ffffff' })
        .greyscale()
        .linear(1.2, 0) // เพิ่ม contrast สูงๆ แทน threshold
        .normalize(); // ไม่ใช้ threshold แต่ใช้ linear contrast

      // ปรับขนาดให้ทุก method
      const scale = metadata.width < 2000 ? Math.min(2.0, 2000 / metadata.width) : 1;
      
      if (scale > 1) {
        method1.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { kernel: 'lanczos3' }
        );
        method2.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { kernel: 'lanczos3' }
        );
        method3.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { kernel: 'lanczos3' }
        );
      }

      // บันทึกทุก method (ใช้ PNG Lossless)
      await Promise.all([
        method1.png({ compressionLevel: 0 }).toFile(outputPath1),
        method2.png({ compressionLevel: 0 }).toFile(outputPath2),
        method3.png({ compressionLevel: 0 }).toFile(outputPath3)
      ]);

      return {
        method1: outputPath1,
        method2: outputPath2,
        method3: outputPath3
      };

    } catch (error) {
      return { method1: inputPath, method2: inputPath, method3: inputPath };
    }
  }
  /**
 * ทำความสะอาดไฟล์ชั่วคราว
 */
  cleanup() {
    tempPathManager.cleanupByType('image');
  }
}

module.exports = ImagePreprocessor;
