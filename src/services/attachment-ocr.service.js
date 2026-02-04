const extractors = require('./extractors');
const { runOCR } = require('./ocr/ocr.service');
const prisma = require('../utils/prisma');

// Threshold for PDF text detection (if < 100 chars, attempt to OCR scanned pages)
const PDF_TEXT_THRESHOLD = 100;

/**
 * Extract text from file based on type
 */
async function extractText(file) {
  const { filePath, fileType, originalName } = file;

  try {
    // ---------- IMAGE FILES ----------
    if (fileType.startsWith('image/')) {
      return await runOCR(filePath);
    }

    // ---------- PDF ----------
    if (fileType === 'application/pdf') {
      // PDF extraction now handles both text and scanned PDFs
      let text = await extractors.pdf(filePath);
      return text;
    }

    // ---------- TEXT DOCUMENTS ----------
    if (fileType === 'text/csv') {
      return await extractors.csv(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return await extractors.docx(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return await extractors.xlsx(filePath);
    }

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      return await extractors.pptx(filePath);
    }

    // Unsupported file type
    return '';
  } catch (err) {
    throw new Error(`extractText failed for ${originalName}: ${err.message}`);
  }
}

/**
 * Process attachments that don't have extractedText yet
 * Only logs errors and final summary
 */
async function processAttachmentsOCR(limit = 10) {
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
  const results = [];

  for (const att of attachments) {
    try {
      const file = { 
        filePath: att.filePath, 
        fileType: att.fileType, 
        originalName: att.fileName 
      };

      // Extract with timeout (30s)
      const extractPromise = extractText(file);
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

      await prisma.attachment.update({
        where: { id: att.id },
        data: { extractedText: text || '' },
      });

      results.push({
        fileName: att.fileName,
        fileType: att.fileType,
        extracted: text && text.trim().length > 0
      });
      processed++;
    } catch (err) {
      console.error(`❌ ${att.fileName}: ${err.message}`);
      results.push({ 
        fileName: att.fileName, 
        error: err.message 
      });
      errors++;
    }
  }

  const summary = {
    total: attachments.length,
    processed,
    errors,
    successful: processed - errors
  };

  console.log(`\n✅ Summary: Processed ${processed}/${attachments.length} (${errors} errors)\n`);
  return { ...summary, results };
}

module.exports = { extractText, processAttachmentsOCR };
