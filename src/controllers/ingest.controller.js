const { fetchEmails, fetchEmailByUid } = require('../services/imap.service');

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

module.exports = { 
    fetchEmailsPreview, 
    saveSelectedEmails
};
