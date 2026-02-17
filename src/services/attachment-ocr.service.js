const extractors = require('./extractors');
const { runOCR } = require('./ocr/ocr.service');
const prisma = require('../utils/prisma');

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
    take: limit,
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
      
      // อัปเดต extractedText ใน database ด้วยข้อมูลจริง
      if (hasText) {
        try {
          await prisma.attachment.update({
            where: { id: att.id },
            data: { 
              extractedText: text,
              ocrStatus: 'COMPLETED'
            }
          });
          console.log(`  📊 Updated extracted text for ${att.fileName}: ${text.length} characters`);
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
  processAttachmentsOCR
};
