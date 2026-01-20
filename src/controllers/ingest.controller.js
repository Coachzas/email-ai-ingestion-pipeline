const { fetchEmails } = require('../services/imap.service')
// ฟังก์ชันควบคุมเพื่อจัดการคำขอ(ดึงอีเมล(fetch-email))
async function runFetch(req, res) {
    try {
        await fetchEmails();
        res.json({
            status: 'success',
            message: 'ดึงข้อมูล IMAP เสร็จสมบูรณ์มลแล้ว'
        }); // ส่งข้อความยืนยันความสำเร็จกลับไปยังไคลเอนต์
    } catch (err) {
        console.error('IMAP ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: err.message,
        }); // ส่งข้อความยืนยันความล้มเหลวกลับไปยังไคลเอนต์
    }
}

module.exports = { runFetch };
