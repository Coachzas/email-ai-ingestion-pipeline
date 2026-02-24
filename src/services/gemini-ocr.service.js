const GeminiExtractor = require('./extractors/gemini.extractor');
const path = require('path');
const fs = require('fs');

/**
 * Gemini OCR Service
 * บริการหลักสำหรับ OCR โดยใช้ Google AI Studio (Gemini)
 */
class GeminiOcrService {
  constructor() {
    this.extractor = new GeminiExtractor();
  }

  /**
   * ดึงข้อความจากพาธไฟล์ (รองรับทั้งรูปภาพและ PDF)
   * @param {string} filePath - พาธไฟล์ที่จะดึงข้อความ
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @returns {Promise<string>} - ข้อความที่ดึงได้
   */
  async extractTextFromPath(filePath, options = {}) {
    try {
      console.log(`🔍 Gemini Service: Processing file: ${filePath}`);
      const result = await this.extractor.extractTextFromPath(filePath, options);
      console.log(`✅ Gemini Service: Extraction completed (${result.length} characters)`);
      return result;
    } catch (error) {
      console.error(`❌ Gemini Service: Failed to extract text from ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * ดึงข้อความจาก buffer (สำหรับ PDF pages หรือรูปภาพใน memory)
   * @param {Buffer} buffer - ข้อมูลไฟล์เป็น buffer
   * @param {string} mimeType - MIME type ของไฟล์
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @returns {Promise<string>} - ข้อความที่ดึงได้
   */
  async extractTextFromBuffer(buffer, mimeType, options = {}) {
    try {
      console.log(`🔍 Gemini Service: Processing buffer (${buffer.length} bytes, ${mimeType})`);
      const result = await this.extractor.extractTextFromBuffer(buffer, mimeType, options);
      console.log(`✅ Gemini Service: Buffer extraction completed (${result.length} characters)`);
      return result;
    } catch (error) {
      console.error('❌ Gemini Service: Failed to extract text from buffer:', error.message);
      throw error;
    }
  }

  /**
   * ทดสอบการเชื่อมต่อกับ Gemini API
   * @returns {Promise<boolean>} - ผลการทดสอบ
   */
  async testConnection() {
    try {
      console.log('🔍 Gemini Service: Testing API connection...');
      const result = await this.extractor.testConnection();
      console.log(`✅ Gemini Service: Connection test result: ${result}`);
      return result;
    } catch (error) {
      console.error('❌ Gemini Service: Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * ดึงข้อความจากหลายไฟล์พร้อมกัน (batch processing)
   * @param {Array<string>} filePaths - รายการพาธไฟล์
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @returns {Promise<Array>} - ผลลัพธ์จากทุกไฟล์
   */
  async extractTextFromMultipleFiles(filePaths, options = {}) {
    console.log(`🔍 Gemini Service: Starting batch processing for ${filePaths.length} files`);
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const text = await this.extractTextFromPath(filePath, options);
        results.push({
          filePath,
          success: true,
          text,
          error: null
        });
        console.log(`✅ Gemini Service: Successfully processed ${filePath}`);
      } catch (error) {
        results.push({
          filePath,
          success: false,
          text: null,
          error: error.message
        });
        console.error(`❌ Gemini Service: Failed to process ${filePath}:`, error.message);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 Gemini Service: Batch completed - ${successCount}/${filePaths.length} files successful`);
    
    return results;
  }

  /**
   * ตรวจสอบว่าไฟล์รองรับหรือไม่
   * @param {string} filePath - พาธไฟล์
   * @returns {boolean} - ผลการตรวจสอบ
   */
  isSupportedFile(filePath) {
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.bmp', '.gif', '.tiff'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(ext);
  }
}

// Export singleton instance
const geminiOcrService = new GeminiOcrService();

module.exports = {
  extractTextFromPath: geminiOcrService.extractTextFromPath.bind(geminiOcrService),
  extractTextFromBuffer: geminiOcrService.extractTextFromBuffer.bind(geminiOcrService),
  testConnection: geminiOcrService.testConnection.bind(geminiOcrService),
  extractTextFromMultipleFiles: geminiOcrService.extractTextFromMultipleFiles.bind(geminiOcrService),
  isSupportedFile: geminiOcrService.isSupportedFile.bind(geminiOcrService),
  GeminiOcrService
};
