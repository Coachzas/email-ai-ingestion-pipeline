const extractors = require('./extractors');
const GeminiOcrService = require('./gemini-ocr.service');
const prisma = require('../utils/prisma');

/**
 * ทำความสะอาดข้อความสำหรับ database
 */
function sanitizeText(text) {
  if (!text) return '';
  return text
    .replace(/\x00/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * PURE FUNCTION: ดึงข้อความจากไฟล์โดยไม่มี side effects
 * รับแค่ filePath และคืนข้อความเท่านั้น
 */
async function extractTextFromPath(filePath, attachmentId = null) {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.webp':
    case '.bmp':
    case '.tiff':
    case '.gif':
      try {
        // ใช้ image extractor ที่มีการบันทึกข้อมูลแล้ว
        const imageResult = await extractors.image(filePath, attachmentId);
        const sanitizedResult = sanitizeText(imageResult || '');
        
        // Log ผลลัพธ์สำหรับ debugging
        if (sanitizedResult.length > 0) {
          console.log(`✅ OCR Success for ${path.basename(filePath)}: ${sanitizedResult.length} chars`);
        } else {
          console.log(`⚠️ OCR Empty for ${path.basename(filePath)} - No text found in image`);
        }
        
        return sanitizedResult;
      } catch (ocrErr) {
        console.error(`❌ OCR Failed for ${path.basename(filePath)}:`, ocrErr.message);
        // คืนค่า null แทน empty string เพื่อให้รู้ว่าเกิด error
        return null;
      }
    case '.pdf':
      try {
        const pdfResult = await extractors.pdf(filePath, attachmentId);
        return sanitizeText(pdfResult || '');
      } catch (pdfErr) {
        return '';
      }
    case '.csv':
      try {
        const csvResult = await extractors.csv(filePath);
        return sanitizeText(csvResult || '');
      } catch (csvErr) {
        return '';
      }
    case '.docx':
      try {
        const docxResult = await extractors.docx(filePath);
        return sanitizeText(docxResult || '');
      } catch (docxErr) {
        return '';
      }
    case '.xlsx':
      try {
        const xlsxResult = await extractors.xlsx(filePath);
        return sanitizeText(xlsxResult || '');
      } catch (xlsxErr) {
        return '';
      }
    case '.pptx':
      try {
        const pptxResult = await extractors.pptx(filePath);
        return sanitizeText(pptxResult || '');
      } catch (pptxErr) {
        return '';
      }
    default:
      return '';
  }
}


/**
 * แบ่ง array เป็น chunks สำหรับ parallel processing
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * ประมวลผล attachment เดียวพร้อม progress tracking
 */
async function processAttachment(attachment, index, total) {
  const fs = require('fs');
  
  try {
    if (!fs.existsSync(attachment.filePath)) {
      console.log(`❌ File not found: ${attachment.filePath} - Marking as FAILED`);
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { ocrStatus: 'FAILED' }
      });
      return { success: false, fileName: attachment.fileName, error: 'File not found' };
    }

    // อัปเดตสถานะเป็นกำลังประมวลผล
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { ocrStatus: 'PROCESSING' }
    });

    const extractedText = await extractTextFromPath(attachment.filePath, attachment.id);
    
    // ตรวจสอบผลลัพธ์ก่อนบันทึก
    if (extractedText === null) {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { ocrStatus: 'FAILED' }
      });
      return { success: false, fileName: attachment.fileName, error: 'OCR failed' };
    }
    
    if (extractedText === '') {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { 
          extractedText: '',
          ocrStatus: 'COMPLETED'
        }
      });
      return { success: true, fileName: attachment.fileName, textLength: 0, skipped: true };
    }
    
    // บันทึกผลลัพธ์
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        extractedText: extractedText,
        ocrStatus: 'COMPLETED'
      }
    });

    return { success: true, fileName: attachment.fileName, textLength: extractedText.length };
  } catch (error) {
    console.error(`❌ Error processing ${attachment.fileName}:`, error.message);
    try {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { ocrStatus: 'FAILED' }
      });
    } catch (updateErr) {
      console.error(`❌ Failed to update status for ${attachment.fileName}:`, updateErr.message);
    }
    return { success: false, fileName: attachment.fileName, error: error.message };
  }
}

/**
 * ประมวลผล attachments แบบ parallel พร้อม delay ระหว่าง batches
 */
async function processAttachmentsInParallel(attachments, concurrency = 3, delayBetweenBatches = 500) {
  const chunks = chunkArray(attachments, concurrency);
  let processed = 0;
  let errors = 0;
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`📦 Processing batch ${i + 1}/${chunks.length} (${chunk.length} files)`);
    
    // ประมวลผล parallel ใน batch
    const chunkPromises = chunk.map((attachment, chunkIndex) => 
      processAttachment(attachment, processed + chunkIndex, attachments.length)
    );
    
    const chunkResults = await Promise.allSettled(chunkPromises);
    
    // ประมวลผลผลลัพธ์จาก batch
    chunkResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const attachmentResult = result.value;
        results.push(attachmentResult);
        
        if (attachmentResult.success) {
          processed++;
          if (attachmentResult.skipped) {
            console.log(`📄 OCR skipped for ${attachmentResult.fileName} - no text to extract`);
          } else {
            console.log(`✅ OCR completed for ${attachmentResult.fileName} - ${attachmentResult.textLength} chars`);
          }
        } else {
          errors++;
          console.log(`❌ OCR failed for ${attachmentResult.fileName} - ${attachmentResult.error}`);
        }
      } else {
        errors++;
        console.log(`❌ OCR failed for ${chunk[index].fileName} - ${result.reason?.message || result.reason}`);
        results.push({ success: false, fileName: chunk[index].fileName, error: result.reason?.message || 'Unknown error' });
      }
    });
    
    // อัปเดต progress หลัง batch
    if (global.updateOcrProgress) {
      const currentFileName = results[results.length - 1]?.fileName || 'Processing...';
      global.updateOcrProgress(currentFileName, processed, attachments.length);
    }
    
    // Delay ระหว่าง batches (ยกเว้น batch สุดท้าย)
    if (i < chunks.length - 1) {
      console.log(`⏱️ Waiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return { processed, errors, results };
}

/**
 * Process OCR for new emails (attachments that haven't been processed yet)
 */
async function processAttachmentsForNewEmails() {
  try {
    const prisma = require('../utils/prisma');
    
    // ดึง attachments ที่ยังไม่ได้ประมวลผล OCR (เรียงตามลำดับ)
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [
          { ocrStatus: null },
          { ocrStatus: { not: 'COMPLETED' } }
        ]
      },
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            receivedAt: true
          }
        }
      },
      orderBy: [
        { email: { receivedAt: 'asc' } }, // เรียงตามวันที่อีเมล
        { id: 'asc' } // เรียงตาม ID ถ้าวันที่เดียวกัน
      ]
    });

    console.log(`🔍 Found ${attachments.length} attachments to process for OCR`);

    if (attachments.length === 0) {
      return {
        success: true,
        processed: 0,
        errors: 0,
        message: 'No attachments to process'
      };
    }

    const result = await processAttachmentsInParallel(attachments);

    return {
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `Processed ${result.processed} attachments, ${result.errors} errors`
    };

  } catch (error) {
    console.error('❌ processAttachmentsForNewEmails failed:', error);
    return {
      success: false,
      processed: 0,
      errors: 0,
      message: error.message
    };
  }
}

module.exports = { 
  extractTextFromPath, 
  sanitizeText,
  processAttachmentsForNewEmails
};