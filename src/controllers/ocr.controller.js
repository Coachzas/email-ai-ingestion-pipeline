const { processAttachmentsOCR } = require('../services/attachment-ocr.service');

// ฟังก์ชันควบคุมเพื่อจัดการคำขอ OCR สำหรับไฟล์แนบ
async function runOCR(req, res) {
    // กำหนดค่าจำนวนไฟล์ที่ต้องการประมวลผลจากคำขอ หรือใช้ค่าเริ่มต้นเป็น 3
    const limit = Number(req.body?.limit) || 3;
    try {
        await processAttachmentsOCR(limit);
        res.json({
            status: 'success',
            message: 'Gemini OCR สำเร็จแล้ว'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { runOCR };