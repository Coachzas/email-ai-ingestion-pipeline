const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const ImagePreprocessor = require('./image-preprocessor');
const tempPathManager = require('../../config/temp-paths');

const preprocessor = new ImagePreprocessor();

const runOCR = async (imageInput) => {
  try {
    let processedInput = imageInput;
    let preprocessedFiles = [];
    
    if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
      const multiResults = await preprocessor.preprocessImageMultiple(imageInput);
      preprocessedFiles = Object.values(multiResults);
      
      const ocrResults = [];
      
      for (const [method, imagePath] of Object.entries(multiResults)) {
        try {
          const text = await performOCR(imagePath);
          if (text && text.trim().length > 5) { 
            ocrResults.push({
              method,
              text: text.trim(),
              length: text.length
            });
          }
        } catch (err) {
          // Silently ignore method failures
        }
      }
      
      if (ocrResults.length > 0) {
        const best = ocrResults.reduce((prev, current) => 
          current.length > prev.length ? current : prev
        );
        
        cleanupPreprocessedFiles(preprocessedFiles);
        return best.text;
      } else {
        try {
          const originalText = await performOCR(imageInput);
          cleanupPreprocessedFiles(preprocessedFiles);
          
          if (originalText && originalText.trim().length > 5) {
            return cleanText(originalText);
          }
        } catch (originalErr) {
          // Silently ignore original image OCR failure
        }
      }
      
    } else if (Buffer.isBuffer(imageInput)) {
      processedInput = await preprocessor.preprocessBuffer(imageInput);
    }

    const result = await performOCR(processedInput);
    
    if (preprocessedFiles.length > 0) {
      cleanupPreprocessedFiles(preprocessedFiles);
    }
    
    return cleanText(result);

  } catch (err) {
    return '';
  }
};

function cleanupPreprocessedFiles(filePaths) {
  try {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          if (unlinkErr.code === 'EBUSY' || unlinkErr.code === 'EACCES') {
            // Silently ignore busy files
          } else {
            // Silently ignore other cleanup errors
          }
        }
      }
    });
  } catch (error) {
    // Silently ignore cleanup errors
  }
}

/**
 * ฟังก์ชัน OCR จริง
 */
async function performOCR(imageInput) {
  try {
    const worker = await Tesseract.createWorker('tha+eng');

    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      language_model_penalty_non_freq_dict_word: '0.1',
      language_model_penalty_non_dict_word: '0.15',
      preserve_interword_spaces: '1',
      textord_rotation: '0',
      tessedit_do_invert: '0',
      tessedit_zero_rejection: '0',
      tessedit_zero_rejection: 'F',
      tessedit_reject_mode: '1',
      tessedit_minimal_rejection: '0'
    });

    const { data } = await worker.recognize(imageInput);
    
    await worker.terminate();

    return data.text || '';
  } catch (err) {
    return '';
  }
}

/**
 * ทำความสะอาดข้อความ
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

module.exports = { runOCR };