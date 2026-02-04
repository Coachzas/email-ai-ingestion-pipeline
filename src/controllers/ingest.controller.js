const { fetchEmails } = require('../services/imap.service');
const { processAttachmentsOCR } = require('../services/attachment-ocr.service');
const prisma = require('../utils/prisma');

async function runFetch(req, res) {
    try {
        const { startDate, endDate } = req.body || {};
        console.log('📥 Fetching emails...', { startDate, endDate });

        // Pass optional date range to fetchEmails
        const fetchedEmails = await fetchEmails(startDate, endDate);

        console.log('🧠 Running OCR on attachments...');
        const ocrResult = await processAttachmentsOCR(10);

        // Query emails with attachments to return in response
        let emailsWithAttachments = [];
        if (fetchedEmails && fetchedEmails.length > 0) {
            emailsWithAttachments = await prisma.email.findMany({
                where: {
                    id: { in: fetchedEmails.map(e => e.id) }
                },
                include: {
                    attachments: true
                }
            });
        }

        res.json({
            status: 'success',
            message: 'ดึงอีเมล + OCR เสร็จแล้ว',
            emailCount: emailsWithAttachments.length,
            emails: emailsWithAttachments.map(email => ({
                id: email.id,
                imapUid: email.imapUid,
                fromEmail: email.fromEmail,
                subject: email.subject,
                receivedAt: email.receivedAt,
                attachmentCount: email.attachments.length,
                attachments: email.attachments.map(att => ({
                    fileName: att.fileName,
                    fileType: att.fileType,
                    hasExtractedText: !!att.extractedText
                }))
            })),
            ocr: ocrResult,
            startDate: startDate || null,
            endDate: endDate || null
        });
    } catch (err) {
        console.error('PIPELINE ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
}

module.exports = { runFetch };
