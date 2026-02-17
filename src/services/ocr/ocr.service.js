const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const runOCR = async (imageInput) => { // เปลี่ยนชื่อให้กลางๆ เป็น imageInput
  try {
    // 1. สร้าง Worker
    const worker = await Tesseract.createWorker('tha+eng');

    // 2. ตั้งค่า Parameter (เน้นภาษาไทย)
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      preserve_interword_spaces: '1', 
    });

    // 3. เริ่มอ่าน (Tesseract.js รองรับทั้ง Buffer และ File Path)
    const { data } = await worker.recognize(imageInput);
    
    // 4. คืนทรัพยากรให้เครื่อง (ป้องกันเครื่องค้าง)
    await worker.terminate();

    return data.text || '';
  } catch (err) {
    console.error(`❌ OCR Error: ${err.message}`);
    return '';
  }
};

module.exports = { runOCR };