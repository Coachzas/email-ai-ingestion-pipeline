const { fetchEmails, fetchEmailByUid } = require('../services/imap.service');

const { processAttachmentsOCR: processAttachmentsOCRService } = require('../services/attachment-ocr.service');

const prisma = require('../utils/prisma');

const { 
  startEmailProgress, 
  completeEmailProgress, 
  updateCurrentEmail, 
  incrementProcessed, 
  incrementErrors 
} = require('./email-progress.controller');

// ฟังก์ชันรวมสำหรับดึงอีเมล (preview mode) - รวม runFetch และ fetchEmailsPreview
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

        // ดึงอีเมลจาก IMAP แต่ยังไม่บันทึกลงฐานข้อมูล (preview mode)
        const emails = await fetchEmails(startDate, endDate, true, accountConfig); // true = preview mode
        console.log(`📧 Got ${emails.length} emails for preview`);
        
        res.json({
            status: 'success',
            message: 'ดึงอีเมลตัวอย่างเสร็จแล้ว',
            emails: emails.map(email => ({
                imapUid: email.imapUid,
                tempId: `${email.imapUid}_${email.date?.getTime() || Date.now()}`, // เพิ่ม tempId สำหรับการเลือก
                from: email.from,
                subject: email.subject,
                date: email.date,
                receivedAt: email.date, // เพิ่ม receivedAt ให้ frontend ใช้
                text: email.text,
                html: email.html,
                attachmentCount: email.attachments?.length || 0,
                attachments: email.attachments?.map(att => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    size: att.size,
                    hasContent: !!att.content
                })) || []
            })),
            count: emails.length,
            startDate: startDate || null,
            endDate: endDate || null
        });
    } catch (err) {
        console.error('PREVIEW ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch emails preview',
            error: err.message
        });
    }
}

async function getEmailSummary(req, res) {
    try {
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

        // Get email summary from IMAP
        const summary = await fetchEmails(null, null, true, accountConfig); // preview mode to get summary
        
        res.json({
            status: 'success',
            message: 'Email summary retrieved successfully',
            summary: {
                totalEmails: summary.length,
                emailsWithAttachments: summary.filter(email => email.attachments && email.attachments.length > 0).length,
                totalAttachments: summary.reduce((sum, email) => sum + (email.attachments?.length || 0), 0)
            }
        });
    } catch (err) {
        console.error('SUMMARY ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get email summary',
            error: err.message
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

                console.log('📋 Found existing email:', existingEmail);

                if (existingEmail) {
                    console.log(`⏭️  Skipping existing UID: ${uid} (already saved)`);
                    skippedEmails.push({
                        imapUid: uid,
                        reason: 'already exists'
                    });
                    continue;
                }

                // Fetch full email from IMAP
                const fullEmail = await fetchEmailByUid(uid, accountConfig);
                
                if (!fullEmail) {
                    console.log(`❌ Could not fetch email UID ${uid}`);
                    skippedEmails.push({
                        imapUid: uid,
                        reason: 'fetch failed'
                    });
                    incrementErrors();
                    continue;
                }

                // Save email to database
                const savedEmail = await prisma.email.create({
                    data: {
                        imapUid: uid,
                        fromEmail: fullEmail.from?.text || '',
                        subject: fullEmail.subject || '',
                        bodyText: fullEmail.text || '',
                        receivedAt: fullEmail.date || new Date(),
                        accountId: account.id
                    }
                });

                console.log(`💾 Saved email: ${savedEmail.subject}`);

                // Process attachments if any
                if (fullEmail.attachments && fullEmail.attachments.length > 0) {
                    const dir = path.join(__dirname, '../../storage', savedEmail.id);
                    fs.mkdirSync(dir, { recursive: true });

                    for (const attachment of fullEmail.attachments) {
                        try {
                            const filePath = path.join(dir, attachment.filename);
                            fs.writeFileSync(filePath, attachment.content);

                            await prisma.attachment.create({
                                data: {
                                    emailId: savedEmail.id,
                                    fileName: attachment.filename,
                                    fileType: attachment.contentType,
                                    filePath: filePath
                                },
                            });
                            console.log(`    ✅ Saved: ${attachment.filename}`);
                            attachmentStats.saved++;
                        } catch (fileErr) {
                            console.error(`    ❌ Error saving file ${attachment.filename}:`, fileErr.message);
                            attachmentStats.skipped++;
                        }
                        attachmentStats.total++;
                    }
                }

                savedEmails.push(savedEmail);
                incrementProcessed();

            } catch (emailErr) {
                console.error(`❌ Error processing UID ${emailData.imapUid}:`, emailErr.message);
                skippedEmails.push({
                    imapUid: emailData.imapUid,
                    reason: emailErr.message
                });
                incrementErrors();
            }
        }

        await completeEmailProgress();

        res.json({
            status: 'success',
            message: 'Emails saved successfully',
            saved: savedEmails.length,
            skipped: skippedEmails.length,
            attachmentStats: attachmentStats
        });

    } catch (err) {
        console.error('SAVE ERROR:', err);
        await completeEmailProgress();
        res.status(500).json({
            status: 'error',
            message: 'Failed to save emails',
            error: err.message
        });
    }
}

async function processAttachmentsOCR(req, res) {
    try {
        const { emailIds } = req.body || {};
        
        if (!Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'emailIds must be a non-empty array'
            });
        }

        console.log(`🔍 Processing OCR for ${emailIds.length} emails...`);

        const results = [];
        
        for (const emailId of emailIds) {
            try {
                const email = await prisma.email.findUnique({
                    where: { id: emailId },
                    include: { attachments: true }
                });

                if (!email) {
                    results.push({
                        emailId,
                        status: 'error',
                        message: 'Email not found'
                    });
                    continue;
                }

                if (!email.attachments || email.attachments.length === 0) {
                    results.push({
                        emailId,
                        status: 'skipped',
                        message: 'No attachments'
                    });
                    continue;
                }

                // Process OCR for each attachment
                const attachmentResults = [];
                for (const attachment of email.attachments) {
                    try {
                        const ocrResult = await processAttachmentsOCRService(attachment.filePath);
                        
                        // Update attachment with OCR result
                        await prisma.attachment.update({
                            where: { id: attachment.id },
                            data: { extractedText: ocrResult.text }
                        });

                        attachmentResults.push({
                            attachmentId: attachment.id,
                            fileName: attachment.fileName,
                            status: 'success',
                            extractedText: ocrResult.text
                        });

                    } catch (ocrErr) {
                        console.error(`❌ OCR error for attachment ${attachment.fileName}:`, ocrErr.message);
                        attachmentResults.push({
                            attachmentId: attachment.id,
                            fileName: attachment.fileName,
                            status: 'error',
                            error: ocrErr.message
                        });
                    }
                }

                results.push({
                    emailId,
                    subject: email.subject,
                    status: 'success',
                    attachments: attachmentResults
                });

            } catch (emailErr) {
                console.error(`❌ Error processing OCR for email ${emailId}:`, emailErr.message);
                results.push({
                    emailId,
                    status: 'error',
                    message: emailErr.message
                });
            }
        }

        res.json({
            status: 'success',
            message: 'OCR processing completed',
            results: results
        });

    } catch (err) {
        console.error('OCR ERROR:', err);
        res.status(500).json({
            status: 'error',
            message: 'Failed to process OCR',
            error: err.message
        });
    }
}

module.exports = { 
    fetchEmailsPreview, 
    getEmailSummary, 
    saveSelectedEmails, 
    processAttachmentsOCR 
};
