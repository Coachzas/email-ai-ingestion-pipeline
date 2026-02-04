const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');

//ฟังก์ชันสำหรับเชื่อมต่อและดึงข้อมูลอีเมล ผ่านไลบรารีที่ชื่อว่า Imapflow
async function fetchEmails(startDate, endDate, previewMode = false) {
    const client = new ImapFlow({ // configure การเชื่อมต่อ ดึงค่ามาจากไฟล์ .env
        host: process.env.IMAP_HOST,
        port: process.env.IMAP_PORT,
        secure: true,
        auth: { // (Authentication) จาก user/pass ที่ส่งไป
            user: process.env.IMAP_USER,
            pass: process.env.IMAP_PASS,
        },
    });

    try {
        // เชื่อมต่อกับเซิร์ฟเวอร์อีเมล และเปิดกล่องจดหมาย INBOX
        await client.connect();
        await client.mailboxOpen('INBOX');
        console.log('✅ IMAP connected');

        // Build search query - support optional date range
        let searchQuery;
        if (startDate || endDate) {
            searchQuery = {};
            if (startDate) searchQuery.since = new Date(startDate);
            if (endDate) searchQuery.before = new Date(endDate);
            console.log('🔎 Searching emails with date range:', searchQuery);
        } else {
            searchQuery = { all: true };
        }

        // ดึง UID ของอีเมลตามเงื่อนไข
        const uids = await client.search(searchQuery);
        const lastUids = uids.slice(-100); // limit to last 100 matching
        console.log(`📧 Found ${lastUids.length} matching emails`);

        // ถ้าเป็น preview mode ให้คืนค่าอีเมลโดยไม่บันทึก
        if (previewMode) {
            const previewEmails = [];
            
            for (const uid of lastUids) {
                try {
                    console.log(`🔍 Previewing UID: ${uid}...`);
                    
                    // ใช้ ImapFlow ดึง attachment content โดยตรง
                    const msg = await client.fetchOne(uid, { 
                        source: true,
                        bodyStructure: true,
                        envelope: true
                    });
                    const parsed = await simpleParser(msg.source);

                    // Debug attachments content
                    if (parsed.attachments && parsed.attachments.length > 0) {
                        console.log(`📎 UID ${uid} has ${parsed.attachments.length} attachments:`);
                        parsed.attachments.forEach((att, index) => {
                            console.log(`  ${index + 1}. ${att.filename}: content=${att.content ? att.content.length : 'null'} bytes, contentType=${att.contentType}, size=${att.size}`);
                        });
                    }

                    previewEmails.push({
                        imapUid: uid,
                        from: parsed.from?.text || 'Unknown',
                        subject: parsed.subject || 'No Subject',
                        date: parsed.date || new Date(),
                        text: parsed.text,
                        html: parsed.html,
                        attachments: parsed.attachments?.map(att => ({
                            filename: att.filename,
                            contentType: att.contentType,
                            size: att.size,
                            content: att.content, // เก็บ content จริง
                            path: att.path
                        })) || []
                    });
                    const attachmentCount = parsed.attachments?.length || 0;
                    const totalContentSize = parsed.attachments?.reduce((sum, att) => sum + (att.content?.length || 0), 0) || 0;
                    console.log(`📧 Previewed: ${parsed.subject || 'No Subject'} (${parsed.from?.text || 'Unknown'}) - ${attachmentCount} attachments (${totalContentSize} bytes)`);
                } catch (msgErr) {
                    console.error(`❌ Failed to preview UID ${uid}:`, msgErr.message);
                }
            }
            
            return previewEmails;
        }

        // ดึงอีเมลทีละฉบับตาม UID ที่ได้มา (normal mode)
        for (const uid of lastUids) {
            try {
                console.log(`⏳ Processing UID: ${uid}...`);
                const msg = await client.fetchOne(uid, { source: true });
                const parsed = await simpleParser(msg.source); // simpleParser จะทำหน้าที่ ถอดรหัส ให้กลายเป็น Object ที่เราเรียกใช้งานง่ายๆ เช่น parsed.subject หรือ parsed.text

                // เช็คก่อนว่า UID นี้เคยเก็บแล้วหรือยัง
                const exists = await prisma.email.findUnique({
                    where: { imapUid: uid },
                });

                if (exists) {
                    console.log(`⏭️  Skipping existing UID: ${uid}`);
                    continue;
                }

                const email = await prisma.email.create({ // prisma.email.create: สั่งให้ ORM (Prisma) นำข้อมูลที่เราแกะได้ไป Insert ลงในตาราง email ใน Database
                    data: {
                        imapUid: uid,
                        fromEmail: parsed.from?.text || '',
                        subject: parsed.subject || '',
                        bodyText: parsed.text || '',
                        receivedAt: parsed.date || new Date(),
                    }, // การใช้ || '' หรือ || new Date(): เป็นการป้องกัน Error (Fallback) ในกรณีที่อีเมลฉบับนั้นไม่มีหัวข้อ หรือไม่มีวันที่ส่งมา
                });

                // มี attachments?
                if (parsed.attachments?.length) {
                    console.log(`  📎 Found ${parsed.attachments.length} attachments in "${parsed.subject}"`);
                    //การกำหนดเส้นทางจัดเก็บ (path.join)
                    const dir = path.join(__dirname, '../../storage', email.id);
                    //recursive: true: ถ้าโฟลเดอร์ตามเส้นทางที่ระบุ (เช่น storage/) ยังไม่มีอยู่ ให้สร้างขึ้นมาให้ครบทุกลำดับชั้นโดยอัตโนมัติ รวมถึงจะไม่แจ้ง Error หากโฟลเดอร์นั้นมีอยู่แล้ว
                    fs.mkdirSync(dir, { recursive: true });

                    // บันทึกไฟล์จริงลงใน Disk และ สร้างประวัติไฟล์แนบในฐานข้อมูล
                    // เข้าไปดูใน parsed.attachments (ซึ่งได้มาจาก simpleParser) ว่าอีเมลฉบับนี้มีไฟล์แนบกี่ไฟล์ และหยิบมาจัดการทีละไฟล์จนครบ
                    for (const file of parsed.attachments) {
                        try {
                            // รวมร่างระหว่าง "ที่อยู่โฟลเดอร์" (dir) และ "ชื่อไฟล์" (file.filename) เพื่อให้ได้เส้นทางเต็มของไฟล์ที่จะบันทึกลง Disk
                            const filePath = path.join(dir, file.filename);
                            //fs.writeFileSync: นำข้อมูลดิบของไฟล์ (file.content) เขียนลงไปใน Disk ทันทีตามเส้นทางที่กำหนดไว้
                            fs.writeFileSync(filePath, file.content);

                            // เป็นการสร้าง Foreign Key (emailId) เพื่อเชื่อมไฟล์แนบเข้ากับตัวอีเมลหลัก ทำให้เวลาอยากดูว่า "อีเมลฉบับนี้มีไฟล์อะไรบ้าง" สามารถ Query หาจาก emailId ได้ทันที
                            await prisma.attachment.create({
                                data: {
                                    emailId: email.id, // เชื่อมโยงว่าไฟล์นี้เป็นของอีเมลฉบับไหน
                                    fileName: file.filename,
                                    fileType: file.contentType, // ประเภทไฟล์ เช่น image/jpeg, application/pdf
                                    filePath, // เก็บที่อยู่ไฟล์ไว้สำหรับเรียกใช้งานภายหลัง
                                },
                            });
                            console.log(`    ✅ Saved: ${file.filename}`);
                        } catch (fileErr) {
                            console.error(`    ❌ Error saving file ${file.filename}:`, fileErr.message);
                        }
                    }
                }
                console.log(`📩 Email saved: ${parsed.subject}`);
            } catch (emailErr) {
                console.error(`❌ Error processing UID ${uid}:`, emailErr.message);
            }
        }
        await client.logout(); //บอกให้ Email Server ทราบว่าเราทำงานเสร็จแล้วนะ ให้ปิด Session นี้ได้เลย
        console.log('✅ IMAP fetch completed');
        
        // Return list of fetched emails for controller to reference
        const fetchedEmailIds = await prisma.email.findMany({
            where: {
                receivedAt: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined
                }
            },
            select: { id: true }
        });
        
        return fetchedEmailIds;
    } catch (err) {
        console.error('❌ IMAP Error:', err.message);
        throw err;
    }
}

module.exports = { fetchEmails }; // ส่งออกฟังก์ชัน fetchEmails เพื่อให้ไฟล์อื่นๆ สามารถเรียกใช้งานได้