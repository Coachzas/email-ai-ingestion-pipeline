const extractors = require('./extractors');
const { runOCR } = require('./ocr/ocr.service');
const prisma = require('../utils/prisma');

/**
 * ทำความสะอาดข้อความสำหรับ database
 */
function sanitizeText(text) {
  if (!text) return '';
  
  return text
    // ลบ null bytes และ control characters
    .replace(/\x00/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // แปลง newline ให้เป็นมาตรฐาน
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // ลบช่องว่างซ้ำ
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * PURE FUNCTION: ดึงข้อความจากไฟล์โดยไม่มี side effects
 * รับแค่ filePath และคืนข้อความเท่านั้น
 */
async function extractTextFromPath(filePath) {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  console.log(`🔍 Pure function extracting from: ${path.basename(filePath)} (${ext})`);
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.bmp':
    case '.tiff':
    case '.gif':
      console.log(`🔍 Using OCR for image: ${path.basename(filePath)}`);
      try {
        // ตรวจสอบว่าไฟล์มีอยู่จริง
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ Image file not found: ${filePath}`);
          return '';
        }
        
        console.log(`🔍 Image file exists, size: ${fs.statSync(filePath).size} bytes`);
        const ocrResult = await runOCR(filePath);
        console.log(`🔍 OCR raw result type:`, typeof ocrResult);
        console.log(`🔍 OCR raw result:`, ocrResult);
        
        // OCR Service ส่งค่ากลับเป็น string ตรงๆ
        const ocrText = sanitizeText(ocrResult || '');
        console.log(`🔍 OCR result: ${ocrText.length} chars`);
        return ocrText;
      } catch (ocrErr) {
        console.warn(`⚠️ OCR failed for image: ${ocrErr.message}`);
        return '';
      }
      
    case '.pdf':
      console.log(`🔍 Using PDF extractor for: ${path.basename(filePath)}`);
      const pdfResult = await extractors.pdf(filePath);
      console.log(`🔍 PDF extractor raw result:`, pdfResult);
      console.log(`🔍 PDF extractor result type:`, typeof pdfResult);
      console.log(`🔍 PDF extractor result length:`, pdfResult ? pdfResult.length : 'undefined/null');
      
      const pdfText = sanitizeText(pdfResult || '');
      console.log(`🔍 PDF result after sanitize: ${pdfText.length} chars`);
      return pdfText;
      
    case '.csv':
      console.log(`🔍 Using CSV extractor for: ${path.basename(filePath)}`);
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ CSV file not found: ${filePath}`);
          return '';
        }
        
        console.log(`🔍 CSV file exists, size: ${fs.statSync(filePath).size} bytes`);
        const csvResult = await extractors.csv(filePath);
        console.log(`🔍 CSV raw result type:`, typeof csvResult);
        console.log(`🔍 CSV raw result:`, csvResult);
        
        // CSV extractor ส่งค่ากลับเป็น string ตรงๆ
        const csvText = sanitizeText(csvResult || '');
        console.log(`🔍 CSV result: ${csvText.length} chars`);
        return csvText;
      } catch (csvErr) {
        console.warn(`⚠️ CSV extraction failed: ${csvErr.message}`);
        return '';
      }
      
    case '.xlsx':
      console.log(`🔍 Using Excel extractor for: ${path.basename(filePath)}`);
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ Excel file not found: ${filePath}`);
          return '';
        }
        
        console.log(`🔍 Excel file exists, size: ${fs.statSync(filePath).size} bytes`);
        const xlsxResult = await extractors.xlsx(filePath);
        console.log(`🔍 Excel raw result type:`, typeof xlsxResult);
        console.log(`🔍 Excel raw result:`, xlsxResult);
        
        // Excel extractor ส่งค่ากลับเป็น string ตรงๆ
        const xlsxText = sanitizeText(xlsxResult || '');
        console.log(`🔍 Excel result: ${xlsxText.length} chars`);
        return xlsxText;
      } catch (xlsxErr) {
        console.warn(`⚠️ Excel extraction failed: ${xlsxErr.message}`);
        return '';
      }
      
    case '.docx':
      console.log(`🔍 Using DOCX extractor for: ${path.basename(filePath)}`);
      try {
        const docxResult = await extractors.docx(filePath);
        console.log(`🔍 DOCX raw result type:`, typeof docxResult);
        console.log(`🔍 DOCX raw result:`, docxResult);
        
        // DOCX extractor ส่งค่ากลับเป็น string ตรงๆ
        const docxText = sanitizeText(docxResult || '');
        console.log(`🔍 DOCX result: ${docxText.length} chars`);
        return docxText;
      } catch (docxErr) {
        console.warn(`⚠️ DOCX extraction failed: ${docxErr.message}`);
        return '';
      }
      
    case '.pptx':
      console.log(`🔍 Using PPTX extractor for: ${path.basename(filePath)}`);
      try {
        const pptxResult = await extractors.pptx(filePath);
        console.log(`🔍 PPTX raw result type:`, typeof pptxResult);
        console.log(`🔍 PPTX raw result:`, pptxResult);
        
        // PPTX extractor ส่งค่ากลับเป็น string ตรงๆ
        const pptxText = sanitizeText(pptxResult || '');
        console.log(`🔍 PPTX result: ${pptxText.length} chars`);
        return pptxText;
      } catch (pptxErr) {
        console.warn(`⚠️ PPTX extraction failed: ${pptxErr.message}`);
        return '';
      }
      
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

/**
 * Extract text from file based on type
 */
async function extractText(file, attachmentId = null) {
  const { filePath, fileType, originalName } = file;

  try {
    console.log(`🔍 Extracting text from: ${originalName} (${fileType})`);
    
    // ---------- IMAGE FILES ----------
    if (fileType.startsWith('image/')) {
      console.log(`📷 Processing image file: ${originalName}`);
      return await runOCR(filePath);
    }

    // ---------- PDF ----------
    if (fileType === 'application/pdf') {
      console.log(`📄 Processing PDF file: ${originalName}`);
      // PDF extraction now handles both text and scanned PDFs
      let text = await extractors.pdf(filePath, attachmentId);
      return text;
    }

    // ---------- TEXT DOCUMENTS ----------
    if (fileType === 'text/csv') {
      console.log(`📊 Processing CSV file: ${originalName}`);
      return await extractors.csv(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      console.log(`📝 Processing DOCX file: ${originalName}`);
      return await extractors.docx(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      console.log(`📊 Processing XLSX file: ${originalName}`);
      return await extractors.xlsx(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      console.log(`📊 Processing PPTX file: ${originalName}`);
      return await extractors.pptx(filePath);
    }

    // Default case
    console.log(`⚠️ Unsupported file type: ${fileType} for file: ${originalName}`);
    return '';
    
  } catch (error) {
    console.error(`❌ Error extracting text from ${originalName}:`, error);
    return '';
  }
}

/**
 * Process attachments that don't have extractedText yet
 * Only logs errors and final summary
 */
async function processAttachmentsOCR(limit = 30) {
  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { extractedText: null },
        { extractedText: '' }
      ]
    },
    take: typeof limit === 'number' ? limit : undefined,
  });

  console.log(`\n📋 OCR Processing: ${attachments.length} attachments\n`);

  let processed = 0;
  let errors = 0;
  let skipped = 0;
  const results = [];

  for (const att of attachments) {
    try {
      // ตรวจสอบว่าไฟล์มีอยู่จริงหรือไม่
      const fs = require('fs');
      if (!fs.existsSync(att.filePath)) {
        console.error(`❌ File not found: ${att.fileName} (${att.filePath})`);
        results.push({
          fileName: att.fileName,
          error: 'File not found on disk',
          status: 'missing'
        });
        errors++;
        continue;
      }

      // ตรวจสอบขนาดไฟล์ ถ้าเป็น empty file ให้ข้าม
      const stats = fs.statSync(att.filePath);
      if (stats.size === 0) {
        console.log(`⚠️  Skipping empty file: ${att.fileName}`);
        results.push({
          fileName: att.fileName,
          status: 'skipped',
          reason: 'Empty file'
        });
        skipped++;
        continue;
      }

      const file = { 
        filePath: att.filePath, 
        fileType: att.fileType, 
        originalName: att.fileName 
      };

      // Extract with timeout (30s for OCR processing)
      const extractPromise = extractText(file, att.id);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Extraction timeout (>30s)')), 30000)
      );

      let text = '';
      try {
        text = await Promise.race([extractPromise, timeoutPromise]);
      } catch (timeoutErr) {
        console.error(`❌ ${att.fileName}: ${timeoutErr.message}`);
        text = '';
        errors++;
      }

      const hasText = text && text.trim().length > 0;
      
      // ทำความสะอาดข้อความก่อนบันทึก
      const sanitizedText = sanitizeText(text);
      
      // อัปเดต extractedText ใน database ด้วยข้อมูลจริง
      if (hasText) {
        try {
          await prisma.attachment.update({
            where: { id: att.id },
            data: { 
              extractedText: sanitizedText,
              ocrStatus: 'COMPLETED'
            }
          });
          console.log(`  📊 Updated extracted text for ${att.fileName}: ${sanitizedText.length} characters`);
        } catch (updateErr) {
          console.warn(`  ⚠️ Failed to update extracted text: ${updateErr.message}`);
        }
      } else {
        // ถ้าไม่มีข้อความ ก็อัปเดตสถานะ COMPLETED
        try {
          await prisma.attachment.update({
            where: { id: att.id },
            data: { ocrStatus: 'COMPLETED' }
          });
        } catch (updateErr) {
          console.warn(`  ⚠️ Failed to update status: ${updateErr.message}`);
        }
      }
      
      results.push({
        fileName: att.fileName,
        fileType: att.fileType,
        extracted: hasText,
        textLength: text ? text.length : 0,
        status: hasText ? 'success' : 'no_text'
      });
      
      if (hasText) {
        processed++;
      } else {
        skipped++;
        console.log(`⚠️  ${att.fileName}: No text extracted`);
      }
    } catch (err) {
      console.error(`❌ ${att.fileName}: ${err.message}`);
      results.push({ 
        fileName: att.fileName, 
        error: err.message,
        status: 'error'
      });
      errors++;
    }
  }

  const summary = {
    total: attachments.length,
    processed,
    errors,
    skipped,
    successful: processed,
    results
  };

  console.log(`\n✅ Summary: Processed ${processed}/${attachments.length} (${errors} errors, ${skipped} no text)\n`);
  return { ...summary };
}


module.exports = { 
  extractTextFromPath,  // Pure Function สำหรับ Worker
  processAttachmentsOCR // Legacy function (จะถูก replace ด้วย Worker)
};
