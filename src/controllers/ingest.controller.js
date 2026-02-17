const { fetchEmails, fetchEmailByUid } = require('../services/imap.service');

const { processAttachmentsOCR } = require('../services/attachment-ocr.service');

const prisma = require('../utils/prisma');

const { 
  startEmailProgress, 
  completeEmailProgress, 
  updateCurrentEmail, 
  incrementProcessed, 
  incrementErrors 
} = require('./email-progress.controller');

async function runFetch(req, res) {

    try {
        const { startDate, endDate } = req.body || {};

        console.log('📥 Fetching emails...', { startDate, endDate });

        // Get the selected account
        const account = await prisma.emailAccount.findFirst({
            where: { 
              status: 'ACTIVE',
              isSelected: true 
            },
            select: {
                id: true,
                name: true,
                host: true,
                port: true,
                secure: true,
                username: true,
                password: true,
                status: true
            }
        });

        if (!account) {
            return res.status(400).json({
                status: 'error',
                message: 'No active email account found. Please configure an email account first.'
            });
        }

        // Create account config for IMAP service
        const accountConfig = {
            id: account.id,
            host: account.host,
            port: account.port,
            secure: account.secure,
            auth: {
                user: account.username,
                pass: account.password,
            }
        };

        // Pass optional date range to fetchEmails (preview mode)
        const fetchedEmails = await fetchEmails(startDate, endDate, true, accountConfig);
        console.log('✅ Email preview completed');
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
async function fetchEmailsPreview(req, res) {
    try {
        const { startDate, endDate } = req.body || {};
        console.log('🔍 Fetching emails preview...', { startDate, endDate });

        // Get the selected account
        const account = await prisma.emailAccount.findFirst({
            where: { 
              status: 'ACTIVE',
              isSelected: true 
            },
            select: {
                id: true,
                name: true,
                host: true,
                port: true,
                secure: true,
                username: true,
                password: true,
                status: true
            }
        });

        if (!account) {
            return res.status(400).json({
                status: 'error',
                message: 'No active email account found. Please configure an email account first.'
            });
        }

        // Create account config for IMAP service
        const accountConfig = {
            id: account.id,
            host: account.host,
            port: account.port,
            secure: account.secure,
            auth: {
                user: account.username,
                pass: account.password,
            }
        };

        // ดึงอีเมลจาก IMAP แต่ยังไม่บันทึกลงฐานข้อมูล
        const emails = await fetchEmails(startDate, endDate, true, accountConfig); // true = preview mode
        console.log(`📧 Got ${emails.length} emails for preview`);
        res.json({

            status: 'success',
            message: 'ดึงอีเมลตัวอย่างเสร็จแล้ว',
            emails: emails.map(email => {
                console.log(`📋 Email: ${email.subject} (${email.from}) - ${email.attachmentCount} attachments`);

                return {

                    // ใช้ข้อมูลจาก IMAP โดยตรง ยังไม่มี ID
                    tempId: `${email.imapUid}_${email.date}`,
                    imapUid: email.imapUid,
                    fromEmail: email.from,
                    subject: email.subject,
                    receivedAt: email.date,
                    body: email.text || email.html,
                    attachmentCount: email.attachments ? email.attachments.length : 0,

                    attachments: email.attachments || []

                };

            }),

            count: emails.length,

            startDate: startDate || null,

            endDate: endDate || null

        });

    } catch (err) {

        console.error('PREVIEW ERROR:', err);

        res.status(500).json({

            status: 'error',

            message: err.message,

        });

    }

}



async function saveSelectedEmails(req, res) {

    try {

        const { selectedEmails } = req.body || {};

        console.log(`💾 Saving selected emails...`);
        console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

        // Get the selected account
        const account = await prisma.emailAccount.findFirst({
            where: { 
              status: 'ACTIVE',
              isSelected: true 
            },
            select: {
                id: true,
                name: true,
                host: true,
                port: true,
                secure: true,
                username: true,
                password: true,
                status: true
            }
        });

        if (!account) {
            return res.status(400).json({
                status: 'error',
                message: 'No active email account found. Please configure an email account first.'
            });
        }

        // Create account config for IMAP service
        const accountConfig = {
            id: account.id,
            host: account.host,
            port: account.port,
            secure: account.secure,
            auth: {
                user: account.username,
                pass: account.password,
            }
        };

        // รับทั้ง selectedEmails (full objects) หรือ selectedUids (array of numbers)
        let emailsToProcess = selectedEmails;
        
        if (!emailsToProcess || !Array.isArray(emailsToProcess)) {
            return res.status(400).json({
                status: 'error',
                message: 'selectedEmails must be an array'
            });
        }

        console.log(`💾 Processing ${emailsToProcess.length} emails...`);

        // Start progress tracking
        await startEmailProgress(emailsToProcess.length);

        const savedEmails = [];
        const skippedEmails = [];

        const attachmentStats = {
            total: 0,
            saved: 0,
            skipped: 0
        };

        console.log(`📧 Processing ${emailsToProcess.length} selected emails for saving...`);

        const fs = require('fs');
        const path = require('path');

        for (const emailData of emailsToProcess) {

            console.log(`\n🔍 Processing email: ${emailData.subject} (${emailData.imapUid})`);

            // Update progress with current email
            updateCurrentEmail(emailData.subject || `UID ${emailData.imapUid}`);

            console.log('📋 Email data:', JSON.stringify(emailData, null, 2));

            try {

                const uid = Number(emailData.imapUid);
                if (!Number.isFinite(uid)) {
                    skippedEmails.push({
                        imapUid: emailData.imapUid,
                        reason: 'invalid imapUid'
                    });
                    incrementErrors();
                    continue;
                }

                console.log(`🔍 Checking if UID ${uid} exists in database...`);
                const existingEmail = await prisma.email.findUnique({
                    where: { imapUid: uid }
                });

                console.log(`📋 Found existing email:`, existingEmail);

                if (existingEmail) {
                    console.log(`⏭️  Skipping existing UID: ${uid} (already saved)`);
                    skippedEmails.push({
                        imapUid: uid,
                        reason: 'already exists'
                    });
                    continue;
                }

                // ดึงอีเมลจาก IMAP ใหม่เพื่อให้ได้ attachment content จริงๆ (ไม่พึ่งข้อมูลจาก UI)
                const parsed = await fetchEmailByUid(uid, accountConfig);

                const emailDataToSave = {
                    imapUid: uid,
                    fromEmail: parsed.from?.text || emailData.fromEmail || '',
                    subject: parsed.subject || emailData.subject || '',
                    bodyText: parsed.text || parsed.html || emailData.body || '',
                    receivedAt: parsed.date || (emailData.receivedAt ? new Date(emailData.receivedAt) : new Date()),
                    accountId: account.id
                };

                const savedEmail = await prisma.email.create({
                    data: emailDataToSave,
                    include: { attachments: true }
                });

                let attachmentsSavedForThisEmail = 0;
                let attachmentsSkippedForThisEmail = 0;

                if (parsed.attachments && parsed.attachments.length > 0) {
                    console.log(`📎 UID ${uid} has ${parsed.attachments.length} attachments from IMAP`);

                    const storageDir = path.join(__dirname, '../../storage', savedEmail.id.toString());
                    fs.mkdirSync(storageDir, { recursive: true });

                    for (const file of parsed.attachments) {
                        attachmentStats.total++;
                        try {
                            const fileName = file.filename || 'unknown';
                            const absoluteFilePath = path.join(storageDir, fileName);
                            const relativeFilePath = `storage/${savedEmail.id}/${fileName}`;

                            if (!file.content || file.content.length === 0) {
                                attachmentStats.skipped++;
                                attachmentsSkippedForThisEmail++;
                                console.log(`⚠️  No file content for ${fileName}, skipping`);
                                continue;
                            }

                            fs.writeFileSync(absoluteFilePath, file.content);

                            await prisma.attachment.create({
                                data: {
                                    emailId: savedEmail.id,
                                    fileName,
                                    fileType: file.contentType || 'application/octet-stream',
                                    filePath: relativeFilePath,
                                    size: file.size || file.content.length
                                }
                            });

                            attachmentStats.saved++;
                            attachmentsSavedForThisEmail++;
                            console.log(`💾 Saved file: ${fileName} (${file.content.length} bytes)`);
                        } catch (fileErr) {
                            attachmentStats.skipped++;
                            attachmentsSkippedForThisEmail++;
                            console.error(`❌ Error saving file ${file.filename}:`, fileErr.message);
                        }
                    }
                }

                savedEmails.push({
                    id: savedEmail.id,
                    imapUid: savedEmail.imapUid,
                    fromEmail: savedEmail.fromEmail,
                    subject: savedEmail.subject,
                    receivedAt: savedEmail.receivedAt,
                    attachmentCount: attachmentsSavedForThisEmail,
                    attachmentSkippedCount: attachmentsSkippedForThisEmail
                });

                console.log(`✅ Saved email UID: ${uid} (attachments saved: ${attachmentsSavedForThisEmail}, skipped: ${attachmentsSkippedForThisEmail})`);

                // Update current email and increment processed count
                updateCurrentEmail(emailData.subject || `UID: ${uid}`);
                incrementProcessed();

                

            } catch (emailErr) {

                console.error(`❌ Failed to save email ${emailData.imapUid}:`, emailErr.message);

                skippedEmails.push({
                    imapUid: emailData.imapUid,
                    reason: emailErr.message
                });
                incrementErrors();
            }
        }
        // Complete progress tracking
        completeEmailProgress();

        let ocrResult = { processed: 0, total: 0 };

        let message = `บันทึกอีเมล ${savedEmails.length} ฉบับเสร็จแล้ว`;
        if (skippedEmails.length > 0) {
            const skippedUids = skippedEmails.map(e => e.imapUid).join(', ');
            message += ` (ข้าม ${skippedEmails.length} ฉบับที่ซ้ำ: UID ${skippedUids})`;
        }
        res.json({
            status: 'success',
            message,
            savedCount: savedEmails.length,
            skippedCount: skippedEmails.length,
            attachmentTotalCount: attachmentStats.total,
            attachmentSavedCount: attachmentStats.saved,
            attachmentSkippedCount: attachmentStats.skipped,
            emails: savedEmails.map(email => ({
                id: email.id,
                imapUid: email.imapUid,
                fromEmail: email.fromEmail,
                subject: email.subject,
                receivedAt: email.receivedAt,
                accountId: account.id,
                attachmentCount: email.attachmentCount
            })),
            skipped: skippedEmails,
            ocr: ocrResult
        });
    } catch (err) {
        console.error('SAVE ERROR:', err);
        // Complete progress with error
        completeEmailProgress();
        res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
}
async function getEmailSummary(req, res) {
    try {
        console.log('📊 Getting email summary...');
        // ดึงข้อมูลอีเมลทั้งหมด
        const totalEmails = await prisma.email.count();

        // ดึงอีเมลที่มีไฟล์แนบ
        const emailsWithAttachments = await prisma.email.findMany({

            include: {

                attachments: true
            }
        });

        const emailsWithFilesCount = emailsWithAttachments.filter(email => 

            email.attachments.length > 0

        ).length;
        const emailsWithoutFilesCount = totalEmails - emailsWithFilesCount;

        // สรุปข้อมูลไฟล์แนบ
        const allAttachments = emailsWithAttachments.flatMap(email => email.attachments);
        const totalAttachments = allAttachments.length;
        // นับสถานะ OCR

        const ocrStats = {
            total: totalAttachments,
            processed: allAttachments.filter(att => att.extractedText && att.extractedText.trim().length > 0).length,

            pending: allAttachments.filter(att => !att.extractedText || att.extractedText.trim() === '').length,
            errors: 0 // จะนับจาก file system ต่อไป
        };
        // ตรวจสอบไฟล์ที่มีปัญหา
        const fs = require('fs');
        const problemFiles = [];
        for (const att of allAttachments) {
            if (!fs.existsSync(att.filePath)) {
                problemFiles.push({
                    fileName: att.fileName,
                    issue: 'File not found on disk'
                });
                ocrStats.errors++;
            }
        }
        // จัดกลุ่มตามประเภทไฟล์
        const fileTypeStats = {};
        allAttachments.forEach(att => {
            const type = att.fileType || 'unknown';
            fileTypeStats[type] = (fileTypeStats[type] || 0) + 1;
        });
        res.json({
            status: 'success',
            summary: {
                totalEmails,
                emailsWithFiles: emailsWithFilesCount,
                emailsWithoutFiles: emailsWithoutFilesCount,
                attachments: {
                    total: totalAttachments,
                    ocrStats,
                    fileTypeStats,
                    problemFiles: problemFiles.slice(0, 10) // แสดง 10 อันแรก
                }
            }
        });
    } catch (err) {

        console.error('SUMMARY ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: err.message,
        });
    }
}

async function processAttachmentsOCRController(req, res) {
    try {
        console.log('🚀 Starting OCR processing via API...');
        const limit = req.body.limit || 30;
        const result = await processAttachmentsOCR(limit);
        
        res.json({
            status: 'success',
            data: result
        });
    } catch (err) {
        console.error('❌ OCR processing error:', err);
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
}

module.exports = { runFetch, getEmailSummary, fetchEmailsPreview, saveSelectedEmails, processAttachmentsOCR: processAttachmentsOCRController };

