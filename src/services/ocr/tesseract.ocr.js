const Tesseract = require('tesseract.js');
const path = require('path');

const TESSDATA_PATH = path.join(process.cwd(), 'tessdata');

module.exports = async (filePath) => {
  console.log('ใช้ tessdata จาก:', TESSDATA_PATH);

  const { data } = await Tesseract.recognize(
    filePath,
    'tha+eng',
    {
      langPath: TESSDATA_PATH, 
      gzip: false,
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR recognizing: ${Math.round(m.progress * 100)}%`);
        }
      },
    }
  );

  return data.text || '';
};
