const prisma = require('../utils/prisma');

// ดึงข้อมูลอีเมลทั้งหมด
async function getEmails(req, res) {
    try {
        const emails = await prisma.email.findMany({
            include: {
                attachments: {
                    select: {
                        id: true,
                        fileName: true,
                        fileType: true,
                        filePath: true,
                        extractedText: true,
                        createdAt: true
                    }
                }
            },
            orderBy: {
                receivedAt: 'desc'
            }
        });

        res.json({
            status: 'success',
            emails,
            total: emails.length
        });
    } catch (error) {
        console.error('❌ Error fetching emails:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch emails'
        });
    }
}

// ดาวน์โหลดไฟล์แนบ
async function downloadAttachment(req, res) {
    try {
        const { id } = req.params;
        
        const attachment = await prisma.attachment.findUnique({
            where: { id }
        });

        if (!attachment) {
            return res.status(404).json({
                status: 'error',
                message: 'Attachment not found'
            });
        }

        const fs = require('fs');
        const path = require('path');
        
        // ตรวจสอบว่าไฟล์มีอยู่จริง
        const filePath = path.join(__dirname, '../../', attachment.filePath);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                status: 'error',
                message: 'File not found on disk'
            });
        }

        // ส่งไฟล์กลับ
        res.download(filePath, attachment.fileName, (err) => {
            if (err) {
                console.error('❌ Error downloading file:', err);
                res.status(500).json({
                    status: 'error',
                    message: 'Failed to download file'
                });
            }
        });
    } catch (error) {
        console.error('❌ Error downloading attachment:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to download attachment'
        });
    }
}

module.exports = {
    getEmails,
    downloadAttachment
};
