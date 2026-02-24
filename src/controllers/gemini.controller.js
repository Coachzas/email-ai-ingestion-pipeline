const { testConnection, extractTextFromPath } = require('../services/gemini-ocr.service');

/**
 * ทดสอบการเชื่อมต่อกับ Gemini API
 */
async function testGeminiConnection(req, res) {
  try {
    console.log('🔍 Testing Gemini API connection...');
    const isConnected = await testConnection();
    
    console.log(`✅ Gemini connection test result: ${isConnected}`);
    
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Gemini API connection successful' : 'Gemini API connection failed'
    });
  } catch (error) {
    console.error('❌ Gemini connection test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to test Gemini connection'
    });
  }
}

/**
 * ทดสอบ OCR กับไฟล์ตัวอย่าง
 */
async function testGeminiOcr(req, res) {
  try {
    const { filePath, attachmentId } = req.body;
    
    console.log('🔍 Testing Gemini OCR with file:', filePath);
    
    if (!filePath) {
      console.log('❌ Missing filePath in request');
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }
    
    console.log('📄 Starting text extraction...');
    const text = await extractTextFromPath(filePath);
    
    console.log(`✅ OCR completed. Extracted ${text.length} characters`);
    console.log('📝 Sample text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    
    res.json({
      success: true,
      text,
      attachmentId,
      message: 'OCR extraction completed'
    });
  } catch (error) {
    console.error('❌ Gemini OCR test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to extract text'
    });
  }
}

module.exports = {
  testGeminiConnection,
  testGeminiOcr
};
