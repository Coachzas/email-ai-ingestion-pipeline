const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');

//ฟังก์ชันสำหรับเชื่อมต่อและดึงข้อมูลอีเมล ผ่านไลบรารีที่ชื่อว่า Imapflow
async function fetchEmails(startDate, endDate, previewMode = false, accountConfig = null) {
    const config = accountConfig || {
        host: process.env.IMAP_HOST,
        port: process.env.IMAP_PORT,
        secure: true,
        auth: {
            user: process.env.IMAP_USER,
            pass: process.env.IMAP_PASS,
        }
    };

    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        timeout: 30000,
        connectionTimeout: 30000,
        authTimeout: 15000,
    });

    try {
        // เชื่อมต่อกับเซิร์ฟเวอร์อีเมล และเปิดกล่องจดหมาย INBOX
        await client.connect();
        await client.mailboxOpen('INBOX');

        let searchQuery = { all: true };
        if (startDate || endDate) {
            searchQuery = {};
            if (startDate) {
                const startThaiDate = new Date(startDate);
                // ถอยหลังไป 1 วันสำหรับ IMAP Search เพื่อให้ครอบคลุมเวลาไทยที่เร็วกว่า UTC
                const safetyDate = new Date(startThaiDate);
                safetyDate.setDate(safetyDate.getDate() - 1); 
                const y = safetyDate.getFullYear();
                const m = String(safetyDate.getMonth() + 1).padStart(2, '0');
                const d = String(safetyDate.getDate()).padStart(2, '0');
                searchQuery.since = `${y}-${m}-${d}`; 
            }
            if (endDate) {
                const endThaiDate = new Date(endDate);
                endThaiDate.setDate(endThaiDate.getDate() + 1); 
                const y = endThaiDate.getFullYear();
                const m = String(endThaiDate.getMonth() + 1).padStart(2, '0');
                const d = String(endThaiDate.getDate()).padStart(2, '0');
                searchQuery.before = `${y}-${m}-${d}`;
            }
        }

        // ดึง UID ของอีเมลตามเงื่อนไข
        const uids = await client.search(searchQuery);
        let uidArray = Array.isArray(uids) ? uids : (uids && typeof uids === 'object' ? Object.values(uids) : (uids ? [uids] : []));
        
        const lastUids = uidArray.slice(-100); // จำกัด 100 อันล่าสุด

        // ถ้าเป็น preview mode ให้คืนค่าอีเมลโดยไม่บันทึก
        if (previewMode) {
            const previewEmails = [];
            for (const uid of lastUids) {
                try {
                    const msg = await client.fetchOne(uid, { source: true, bodyStructure: true, envelope: true });
                    const parsed = await simpleParser(msg.source);

                    // --- เพิ่มส่วนตะแกรงร่อนตรงนี้ ---
                    const receivedAt = parsed.date || new Date();
                    if (startDate || endDate) {
                        const startFilter = startDate ? new Date(startDate) : null;
                        const endFilter = endDate ? new Date(endDate) : null;
                        if (startFilter) startFilter.setHours(0, 0, 0, 0); 
                        if (endFilter) endFilter.setHours(23, 59, 59, 999); 
                        
                        if ((startFilter && receivedAt < startFilter) || (endFilter && receivedAt > endFilter)) continue; 
                    }

                    previewEmails.push({
                        imapUid: uid,
                        from: parsed.from?.text || 'Unknown',
                        subject: parsed.subject || 'No Subject',
                        date: receivedAt,
                        text: parsed.text,
                        html: parsed.html,
                        attachments: parsed.attachments?.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size,
                            content: att.content,
                            path: att.path
                        })) || []
                    });
                } catch (msgErr) { }
            }
            return previewEmails;
        }

        // ดึงอีเมลทีละฉบับตาม UID ที่ได้มา (normal mode)
        for (const uid of lastUids) {
            try {
                const msg = await client.fetchOne(uid, { source: true });
                const parsed = await simpleParser(msg.source); // simpleParser จะทำหน้าที่ ถอดรหัส ให้กลายเป็น Object

                // ตรวจสอบวันที่ตามที่ผู้ใช้เลือก (กรองเพิ่มเติม)
                const receivedAt = parsed.date || new Date();
                if (startDate || endDate) {
                    const startFilter = startDate ? new Date(startDate) : null;
                    const endFilter = endDate ? new Date(endDate) : null;
                    if (startFilter) startFilter.setHours(0, 0, 0, 0);
                    if (endFilter) endFilter.setHours(23, 59, 59, 999);
                    if ((startFilter && receivedAt < startFilter) || (endFilter && receivedAt > endFilter)) continue;
                }

                // เช็คก่อนว่า UID นี้เคยเก็บแล้วหรือยัง
                const exists = await prisma.email.findUnique({ where: { imapUid: uid } });
                if (exists) continue;

                const email = await prisma.email.create({ // นำข้อมูลไป Insert ลงในตาราง email
                    data: {
                        imapUid: uid,
                        fromEmail: parsed.from?.text || '',
                        subject: parsed.subject || '',
                        bodyText: parsed.text || '',
                        receivedAt: parsed.date || new Date(),
                        accountId: accountConfig?.id || null
                    },
                });

                // มี attachments?
                if (parsed.attachments?.length) {
                    const dir = path.join(__dirname, '../../storage', email.id);
                    fs.mkdirSync(dir, { recursive: true });

                    for (const file of parsed.attachments) {
                        try {
                            const filePath = path.join(dir, file.filename);
                            fs.writeFileSync(filePath, file.content); // บันทึกไฟล์จริงลงใน Disk

                            await prisma.attachment.create({ // สร้างประวัติไฟล์แนบในฐานข้อมูล
                                data: {
                                    emailId: email.id,
                                    fileName: file.filename,
                                    fileType: file.contentType,
                                    filePath,
                                },
                            });
                        } catch (fileErr) { }
                    }
                }
            } catch (emailErr) { }
        }
        await client.logout(); // ปิด Session
        
        const dateFilter = {};
        if (startDate) { dateFilter.gte = new Date(startDate); dateFilter.gte.setHours(0,0,0,0); }
        if (endDate) { dateFilter.lte = new Date(endDate); dateFilter.lte.setHours(23,59,59,999); }

        return await prisma.email.findMany({
            where: { receivedAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined },
            select: { id: true }
        });
    } catch (err) {
        throw err;
    }
}

async function fetchEmailByUid(uid, accountConfig = null) {
    const config = accountConfig || {
        host: process.env.IMAP_HOST,
        port: process.env.IMAP_PORT,
        secure: true,
        auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS }
    };
    const client = new ImapFlow({ host: config.host, port: config.port, secure: config.secure, auth: config.auth });
    try {
        await client.connect();
        await client.mailboxOpen('INBOX');
        const msg = await client.fetchOne(uid, { source: true, bodyStructure: true, envelope: true });
        return await simpleParser(msg.source);
    } finally {
        try { await client.logout(); } catch (e) { }
    }
}

module.exports = { fetchEmails, fetchEmailByUid };