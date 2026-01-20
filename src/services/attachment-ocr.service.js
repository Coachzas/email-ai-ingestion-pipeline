const prisma = require('../utils/prisma');
const { geminiOCR } = require('./ocr/gemini.ocr');

// ฟังก์ชันเพื่อประมวลผลไฟล์แนบที่ยังไม่มีการสกัดข้อความด้วย OCR
async function processAttachmentsOCR(limit = 5) {
  const attachments = await prisma.attachment.findMany({
    where: {
      extractedText: null,
      OR: [
        // เลือกเฉพาะไฟล์ที่เป็นรูปภาพหรือ PDF เท่านั้น และ รูปภาพ
        { fileType: { startsWith: 'image/' } },
        { fileType: 'application/pdf' },
      ],
    },
    take: limit,
  });

  // วนลูปประมวลผลไฟล์แนบแต่ละไฟล์
  for (const file of attachments) {
    console.log(`🔍 Gemini OCR: ${file.fileName}`);

    const text = await geminiOCR(file.filePath, file.fileType);

    // บันทึกผลลัพธ์ที่ได้ลงในฐานข้อมูล
    await prisma.attachment.update({
      where: { id: file.id },
      data: { extractedText: text },
    });

    console.log(`✅ OCR saved: ${file.fileName}`);
  }
}

module.exports = { processAttachmentsOCR };
