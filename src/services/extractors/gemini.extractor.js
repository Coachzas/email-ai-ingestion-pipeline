const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const tokenUsageLogger = require('../../utils/token-usage-logger');

/**
 * Gemini AI Extractor for OCR (Images & PDFs)
 * ใช้ Google AI Studio (Gemini) สำหรับการดึงข้อความจากไฟล์
 */
class GeminiExtractor {
  constructor(apiKey = null) {
    // ใช้ API key จาก environment variable หรือที่ส่งเข้ามา
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required. Set it in environment variables or pass it to constructor.');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash" // ลองเอา models/ ออก
    }, { apiVersion: 'v1' });
  }

  /**
   * ดึงข้อความจากพาธไฟล์ (รองรับทั้งรูปภาพและ PDF)
   * @param {string} filePath - พาธไฟล์ที่จะดึงข้อความ
   * @param {Object} options - ตัวเลือกเพิ่มเติม
   * @returns {Promise<string>} - ข้อความที่ดึงได้
   */
  async extractTextFromPath(filePath, options = {}) {
    try {
      console.log(`🔍 Gemini: Starting text extraction from ${filePath}`);
      
      const startTime = Date.now();
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Gemini: File not found: ${filePath}`);
        throw new Error(`File not found: ${filePath}`);
      }

      // อ่านไฟล์เป็น buffer
      const fileBuffer = fs.readFileSync(filePath);
      const fileStats = fs.statSync(filePath);
      
      console.log(`📊 Gemini: File size: ${fileStats.size} bytes, MIME type: ${this.getMimeType(filePath)}`);
      
      // ตรวจสอบขนาดไฟล์ (จำกัด 20MB สำหรับ inline)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (fileStats.size > maxSize) {
        console.error(`❌ Gemini: File too large (${fileStats.size} bytes). Max: ${maxSize} bytes`);
        throw new Error(`File too large (${fileStats.size} bytes). Maximum size is ${maxSize} bytes for inline processing.`);
      }

      // กำหนด MIME type ตามนามสกุลไฟล์
      const mimeType = this.getMimeType(filePath);
      
      // แปลงเป็น base64
      const base64Data = fileBuffer.toString('base64');
      
      console.log(`📤 Gemini: Sending to API (${base64Data.length} chars base64)`);
      
      // สร้าง prompt สำหรับ OCR
      const prompt = options.prompt || this.getDefaultPrompt(mimeType);
      
      // ส่งไปยัง Gemini
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Log token usage
      const usage = response.usageMetadata;
      if (usage) {
        console.log(`📊 Gemini Token Usage:`);
        console.log(`   - Input tokens: ${usage.promptTokenCount || 'N/A'}`);
        console.log(`   - Output tokens: ${usage.candidatesTokenCount || 'N/A'}`);
        console.log(`   - Total tokens: ${usage.totalTokenCount || 'N/A'}`);
        
        // Log to file for history tracking
        const fileName = path.basename(filePath);
        const fileType = path.extname(filePath).toLowerCase().substring(1) || 'unknown';
        
        tokenUsageLogger.logUsage({
          fileName,
          fileType,
          inputTokens: usage.promptTokenCount || 0,
          outputTokens: usage.candidatesTokenCount || 0,
          totalTokens: usage.totalTokenCount || 0,
          processingTime: Date.now() - startTime,
          extractedLength: text.length
        });
      } else {
        console.log(`📊 Gemini Token Usage: Not available in this response`);
      }
      
      console.log(`✅ Gemini: API response received (${text.length} characters)`);
      console.log(`📝 Gemini: Sample: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      return this.cleanText(text);

    } catch (error) {
      console.error('❌ Gemini extraction error:', error.message);
      throw new Error(`Failed to extract text with Gemini: ${error.message}`);
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
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Input must be a Buffer');
      }

      console.log(`🔍 Gemini: Starting text extraction from buffer (${buffer.length} bytes)`);

      // ตรวจสอบขนาด buffer
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (buffer.length > maxSize) {
        console.error(`❌ Gemini: Buffer too large (${buffer.length} bytes). Max: ${maxSize} bytes`);
        throw new Error(`Buffer too large (${buffer.length} bytes). Maximum size is ${maxSize} bytes for inline processing.`);
      }

      // แปลงเป็น base64
      const base64Data = buffer.toString('base64');
      
      console.log(`📤 Gemini: Sending to API (${base64Data.length} chars base64)`);

      // สร้าง prompt
      const prompt = options.prompt || this.getDefaultPrompt(mimeType);
      
      // ส่งไปยัง Gemini
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]);

      const response = await result.response;
      const text = response.text();
      
      // Log token usage
      const usage = response.usageMetadata;
      if (usage) {
        console.log(`📊 Gemini Token Usage:`);
        console.log(`   - Input tokens: ${usage.promptTokenCount || 'N/A'}`);
        console.log(`   - Output tokens: ${usage.candidatesTokenCount || 'N/A'}`);
        console.log(`   - Total tokens: ${usage.totalTokenCount || 'N/A'}`);
      } else {
        console.log(`📊 Gemini Token Usage: Not available in this response`);
      }
      
      console.log(`✅ Gemini: API response received (${text.length} characters)`);
      console.log(`📝 Gemini: Sample: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      return this.cleanText(text);

    } catch (error) {
      console.error('❌ Gemini buffer extraction error:', error.message);
      throw new Error(`Failed to extract text from buffer with Gemini: ${error.message}`);
    }
  }

  /**
   * กำหนด MIME type ตามนามสกุลไฟล์
   * @param {string} filePath - พาธไฟล์
   * @returns {string} - MIME type
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.bmp': 'image/bmp',
      '.gif': 'image/gif',
      '.tiff': 'image/tiff'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * สร้าง default prompt สำหรับ OCR
   * @param {string} mimeType - MIME type ของไฟล์
   * @returns {string} - Prompt สำหรับส่งไปยัง Gemini
   */
  getDefaultPrompt(mimeType) {
    if (mimeType === 'application/pdf') {
      return `Please extract all text content from this PDF document. 
      Include text from all pages in the correct order. 
      Preserve the structure and formatting as much as possible.
      If there are tables, extract them in a readable format.
      Return only the extracted text without any additional commentary.`;
    } else {
      return `Please extract all text content from this image. 
      If there are multiple text elements, arrange them in a logical reading order.
      Preserve the original language (Thai, English, etc.) and formatting.
      Return only the extracted text without any additional commentary.`;
    }
  }

  /**
   * ทำความสะอาดข้อความที่ดึงได้
   * @param {string} text - ข้อความดิบ
   * @returns {string} - ข้อความที่ทำความสะอาดแล้ว
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\n{3,}/g, '\n\n') // ลบขึ้นบรรทัดใหม่ซ้ำๆ
      .replace(/[ \t]+/g, ' ') // ลบ space ซ้ำๆ
      .replace(/^\s+|\s+$/g, '') // ลบ space ที่ขอบ
      .trim();
  }

  /**
   * ทดสอบการเชื่อมต่อกับ Gemini API
   * @returns {Promise<boolean>} - ผลการตรวจสอบ
   */
  async testConnection() {
    try {
      console.log('🔍 Gemini: Testing API connection...');
      
      // ทดสอบด้วยการส่งข้อความง่ายๆ
      const result = await this.model.generateContent('Hello, can you read this?');
      const response = await result.response;
      
      const success = response.text().length > 0;
      console.log(`✅ Gemini: Connection test ${success ? 'passed' : 'failed'}`);
      
      return success;
    } catch (error) {
      console.error('❌ Gemini connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = GeminiExtractor;
