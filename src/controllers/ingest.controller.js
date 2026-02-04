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

async function fetchEmailsPreview(req, res) {
    try {
        const { startDate, endDate } = req.body || {};
        console.log('🔍 Fetching emails preview...', { startDate, endDate });

        // ดึงอีเมลจาก IMAP แต่ยังไม่บันทึกลงฐานข้อมูล
        const emails = await fetchEmails(startDate, endDate, true); // true = preview mode

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
        console.log(`💾 Saving ${selectedEmails.length} selected emails...`);

        const savedEmails = [];
        const skippedEmails = [];
        
        console.log(`📧 Processing ${selectedEmails.length} selected emails for saving...`);
        
        for (const emailData of selectedEmails) {
            console.log(`\n🔍 Processing email: ${emailData.subject} (${emailData.imapUid})`);
            console.log('📋 Email data:', JSON.stringify(emailData, null, 2));
            try {
                // เช็คก่อนว่า imapUid นี้เคยบันทึกแล้วหรือยัง
                const existingEmail = await prisma.email.findUnique({
                    where: { imapUid: emailData.imapUid }
                });

                if (existingEmail) {
                    console.log(`⏭️  Skipping existing UID: ${emailData.imapUid}`);
                    skippedEmails.push({
                        imapUid: emailData.imapUid,
                        reason: 'already exists'
                    });
                    continue;
                }

                // บันทึกอีเมลลงฐานข้อมูล
                let emailDataToSave = {
                    imapUid: emailData.imapUid,
                    fromEmail: emailData.fromEmail,
                    subject: emailData.subject,
                    bodyText: emailData.body,
                    receivedAt: new Date(emailData.receivedAt)
                };

                // มีไฟล์แนบหรือไม่?
                if (emailData.attachments && emailData.attachments.length > 0) {
                    console.log(`📎 Email ${emailData.imapUid} has ${emailData.attachments.length} attachments`);
                    console.log('📋 Attachment details:', JSON.stringify(emailData.attachments, null, 2));
                    
                    // สร้างโฟลเดอร์สำหรับเก็บไฟล์
                    const fs = require('fs');
                    const path = require('path');
                    const storageDir = path.join(__dirname, '../../storage', emailData.imapUid.toString());
                    
                    if (!fs.existsSync(storageDir)) {
                        fs.mkdirSync(storageDir, { recursive: true });
                        console.log(`📁 Created directory: ${storageDir}`);
                    }
                    
                    // สร้าง attachments พร้อมบันทึกไฟล์ (ถ้ามี content)
                    const attachmentsToCreate = [];
                    
                    for (const att of emailData.attachments) {
                        const filePath = path.join(storageDir, att.filename);
                        
                        if (att.content && att.content.length > 0) {
                            let fileContent = Buffer.isBuffer(att.content) ? 
                                att.content : Buffer.from(att.content);
                            fs.writeFileSync(filePath, fileContent);
                            console.log(`💾 Saved file: ${att.filename} (${fileContent.length} bytes)`);
                        } else {
                            console.log(`⚠️  No file content for ${att.filename}, creating placeholder`);
                            // สร้าง empty file เพื่อให้ OCR หาเจอ
                            fs.writeFileSync(filePath, '');
                        }
                        
                        attachmentsToCreate.push({
                            fileName: att.filename || 'unknown',
                            fileType: att.contentType || 'application/octet-stream',
                            filePath: `storage/${emailData.imapUid}/${att.filename}`,
                            size: att.size || 0
                        });
                    }
                    
                    // สร้างอีเมลพร้อม attachments
                    const savedEmail = await prisma.email.create({
                        data: {
                            ...emailDataToSave,
                            attachments: {
                                create: attachmentsToCreate
                            }
                        },
                        include: {
                            attachments: true
                        }
                    });
                    
                    savedEmails.push(savedEmail);
                    console.log(`✅ Saved email WITH attachments UID: ${emailData.imapUid}`);
                } else {
                    // บันทึกอีเมลที่ไม่มีไฟล์แนบ
                    const savedEmail = await prisma.email.create({
                        data: emailDataToSave,
                        include: {
                            attachments: true
                        }
                    });
                    
                    savedEmails.push(savedEmail);
                    console.log(`✅ Saved email WITHOUT attachments UID: ${emailData.imapUid}`);
                }
                
            } catch (emailErr) {
                console.error(`❌ Failed to save email ${emailData.imapUid}:`, emailErr.message);
                skippedEmails.push({
                    imapUid: emailData.imapUid,
                    reason: emailErr.message
                });
            }
        }

        let ocrResult = { processed: 0, total: 0 };
        
        // ทำ OCR สำหรับไฟล์แนบที่เพิ่งบันทึก
        if (savedEmails.length > 0) {
            console.log('🧠 Running OCR on new attachments...');
            ocrResult = await processAttachmentsOCR(savedEmails.reduce((acc, email) => 
                acc + email.attachments.length, 0));
        }

        let message = `บันทึกอีเมล ${savedEmails.length} ฉบับเสร็จแล้ว`;
        if (skippedEmails.length > 0) {
            message += ` (ข้าม ${skippedEmails.length} ฉบับที่ซ้ำ/ผิดพลาด)`;
        }

        res.json({
            status: 'success',
            message,
            savedCount: savedEmails.length,
            skippedCount: skippedEmails.length,
            emails: savedEmails.map(email => ({
                id: email.id,
                imapUid: email.imapUid,
                fromEmail: email.fromEmail,
                subject: email.subject,
                receivedAt: email.receivedAt,
                attachmentCount: email.attachments.length
            })),
            skipped: skippedEmails,
            ocr: ocrResult
        });
    } catch (err) {
        console.error('SAVE ERROR:', err);
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

module.exports = { runFetch, getEmailSummary, fetchEmailsPreview, saveSelectedEmails };
