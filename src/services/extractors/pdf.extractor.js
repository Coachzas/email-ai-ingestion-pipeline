const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { runOCR } = require('../ocr/ocr.service');

// PDF text threshold - moved here to avoid circular dependency
const PDF_TEXT_THRESHOLD = 100;

module.exports = async (filePath) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`PDF file not found: ${filePath}`);
      return '';
    }

    console.log(`📄 Reading PDF: ${path.basename(filePath)}`);

    // Extract text from PDF
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    let extractedText = data.text || '';
    
    // Check if PDF has enough text (not scanned)
    if (extractedText.trim().length < PDF_TEXT_THRESHOLD) {
      console.log(`📄 PDF has insufficient text (${extractedText.trim().length} chars), attempting OCR...`);
      
      try {
        // Convert PDF to images and OCR each page
        // For now, we'll use a simpler approach - try OCR if text is too short
        const pdf2pic = require('pdf2pic');
        const os = require('os');
        const tempDir = os.tmpdir();
        
        // Convert PDF to images
        const convert = pdf2pic.fromPath(filePath, {
          density: 200,
          saveFilename: "page",
          savePath: tempDir,
          format: "png",
          width: 2000,
          height: 2000
        });
        
        const pageImages = await convert.bulk(-1, { responseType: "buffer" });
        let ocrText = '';
        
        for (let i = 0; i < pageImages.length; i++) {
          const pageBuffer = pageImages[i];
          const tempImagePath = path.join(tempDir, `page_${i}.png`);
          
          // Save buffer to temp file
          fs.writeFileSync(tempImagePath, pageBuffer);
          
          try {
            const pageText = await runOCR(tempImagePath);
            ocrText += pageText + '\n';
            console.log(`  └─ OCR page ${i + 1}/${pageImages.length}: ${pageText.length} chars`);
          } catch (ocrErr) {
            console.warn(`  └─ OCR failed for page ${i + 1}: ${ocrErr.message}`);
          } finally {
            // Clean up temp file
            if (fs.existsSync(tempImagePath)) {
              fs.unlinkSync(tempImagePath);
            }
          }
        }
        
        extractedText = ocrText.trim();
        console.log(`📄 OCR completed: ${extractedText.length} total characters`);
        
      } catch (ocrErr) {
        console.warn(`📄 OCR failed for PDF: ${ocrErr.message}`);
        // Fall back to original text extraction
      }
    } else {
      console.log(`📄 PDF has sufficient text: ${extractedText.trim().length} chars`);
    }
    
    return extractedText;
  } catch (err) {
    console.error(`PDF extraction error for ${path.basename(filePath)}: ${err.message}`);
    return '';
  }
};
