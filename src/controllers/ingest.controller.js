const { fetchEmails, fetchEmailByUid } = require('../services/imap.service');

const prisma = require('../utils/prisma');

const { 
  startEmailProgress, 
  completeEmailProgress, 
  updateCurrentEmail, 
  incrementProcessed, 
  incrementErrors 
} = require('./email-progress.controller');

async function fetchEmailsPreview(req, res) {
    try {
        const { startDate, endDate } = req.body || {};

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

        const emails = await fetchEmails(startDate, endDate, true, accountConfig);
        
        res.json({
            status: 'success',
            message: 'ดึงอีเมลตัวอย่างเสร็จแล้ว',
            emails: emails.map(email => ({
                imapUid: email.imapUid,
                tempId: `${email.imapUid}_${email.date?.getTime() || Date.now()}`,
                from: email.from,
                subject: email.subject,
                date: email.date,
                receivedAt: email.date,
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

        let emailsToProcess = selectedEmails;
        
        if (!emailsToProcess || !Array.isArray(emailsToProcess)) {
            return res.status(400).json({
                status: 'error',
                message: 'selectedEmails must be an array'
            });
        }

        await startEmailProgress(emailsToProcess.length);

        const savedEmails = [];
        const skippedEmails = [];
        const attachmentStats = {
            total: 0,
            saved: 0,
            skipped: 0
        };

        const fs = require('fs');
        const path = require('path');

        for (const emailData of emailsToProcess) {
            updateCurrentEmail(emailData.subject || `UID ${emailData.imapUid}`);

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

                const existingEmail = await prisma.email.findUnique({
                    where: { imapUid: uid }
                });

                if (existingEmail) {
                    skippedEmails.push({
                        imapUid: uid,
                        reason: 'already exists'
                    });
                    continue;
                }

                const fullEmail = await fetchEmailByUid(uid, accountConfig);
                
                if (!fullEmail) {
                    skippedEmails.push({
                        imapUid: uid,
                        reason: 'fetch failed'
                    });
                    incrementErrors();
                    continue;
                }

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
                            attachmentStats.saved++;
                        } catch (fileErr) {
                            attachmentStats.skipped++;
                        }
                        attachmentStats.total++;
                    }
                }

                savedEmails.push(savedEmail);
                incrementProcessed();

            } catch (emailErr) {
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
