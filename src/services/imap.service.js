const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");

//ฟังก์ชันสำหรับเชื่อมต่อและดึงข้อมูลอีเมล ผ่านไลบรารีที่ชื่อว่า Imapflow
async function fetchEmails(startDate, endDate, previewMode = false, accountConfig = null, options = {}) {
  const config = accountConfig || {
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
  };

  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : null;
  const returnMeta = !!options.returnMeta;
  const log = typeof options.logger === 'function' ? options.logger : console.log;

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
    await client.mailboxOpen("INBOX");

    let searchQuery = { all: true };
    log(`📧 fetchEmails params: startDate=${startDate || '-'} endDate=${endDate || '-'} previewMode=${previewMode}`);
    if (startDate || endDate) {
      searchQuery = {};
      if (startDate) {
        const startThaiDate = new Date(startDate);
        // ถอยหลังไป 1 วันสำหรับ IMAP Search เพื่อให้ครอบคลุมเวลาไทยที่เร็วกว่า UTC
        const safetyDate = new Date(startThaiDate);
        safetyDate.setDate(safetyDate.getDate() - 1);
        const y = safetyDate.getFullYear();
        const m = String(safetyDate.getMonth() + 1).padStart(2, "0");
        const d = String(safetyDate.getDate()).padStart(2, "0");
        searchQuery.since = `${y}-${m}-${d}`;
      }
      if (endDate) {
        const endThaiDate = new Date(endDate);
        endThaiDate.setDate(endThaiDate.getDate() + 1);
        const y = endThaiDate.getFullYear();
        const m = String(endThaiDate.getMonth() + 1).padStart(2, "0");
        const d = String(endThaiDate.getDate()).padStart(2, "0");
        searchQuery.before = `${y}-${m}-${d}`;
      }
    }

    log(`📧 IMAP searchQuery: ${JSON.stringify(searchQuery)}`);

    // ดึง UID ของอีเมลตามเงื่อนไข
    const uids = await client.search(searchQuery);
    let uidArray = Array.isArray(uids)
      ? uids
      : uids && typeof uids === "object"
        ? Object.values(uids)
        : uids
          ? [uids]
          : [];

    const lastUids = uidArray;

    log(`📧 IMAP search result UIDs: ${lastUids.length}`);

    // ถ้าเป็น preview mode ให้กรองเฉพาะอีเมลที่ยังไม่ได้บันทึก
    if (previewMode) {
      // ตรวจสอบ UID ที่เคยบันทึกแล้ว
      const existingUids = await prisma.email.findMany({
        where: { imapUid: { in: lastUids } },
        select: { imapUid: true },
      });
      const existingUidSet = new Set(existingUids.map((e) => e.imapUid));
      const newUids = lastUids.filter((uid) => !existingUidSet.has(uid));

      const previewEmails = [];
      for (const uid of newUids) {
        try {
          const msg = await client.fetchOne(uid, {
            envelope: true,     // หัวข้อ, ผู้ส่ง, วันที่
            bodyStructure: true, // ✅ โครงสร้าง + จำนวนไฟล์แนบ
            uid: true,
            flags: true,
            size: true
          });

          // --- เพิ่มส่วนตะแกรงร่อนตรงนี้ ---
          const receivedAt = msg.envelope.date ? new Date(msg.envelope.date) : new Date();
          if (startDate || endDate) {
            const startFilter = startDate ? new Date(startDate) : null;
            const endFilter = endDate ? new Date(endDate) : null;
            if (startFilter) startFilter.setHours(0, 0, 0, 0);
            if (endFilter) endFilter.setHours(23, 59, 59, 999);

            if (
              (startFilter && receivedAt < startFilter) ||
              (endFilter && receivedAt > endFilter)
            )
              continue;
          }

          // แปลง bodyStructure เป็นข้อมูลไฟล์แนบ (ไม่โหลดตัวไฟล์จริง)
          const attachments = [];
          if (msg.bodyStructure) {
            const extractAttachments = (parts) => {
              if (!parts) return;
              
              // ถ้าเป็น array ให้วนลูปแต่ละ element
              if (Array.isArray(parts)) {
                parts.forEach(part => extractAttachments(part));
                return;
              }
              
              // ถ้าเป็น object ที่มี childNodes ให้วนลูป childNodes ก่อน
              if (parts.childNodes) {
                parts.childNodes.forEach(child => extractAttachments(child));
              }
              
              // ถ้าเป็น object ที่มี parts ให้วนลูป parts
              if (parts.parts) {
                parts.parts.forEach(part => extractAttachments(part));
              }
              
              // ตรวจสอบว่าเป็น attachment หรือไม่
              if (parts.disposition === 'attachment') {
                attachments.push({
                  filename: parts.dispositionParameters?.filename || parts.parameters?.name || 'unknown',
                  contentType: parts.type || 'application/octet-stream',
                  size: parts.size || 0,
                  hasContent: false // Preview ไม่มีตัวไฟล์จริง
                });
              }
            };
            extractAttachments(msg.bodyStructure);
          }

          previewEmails.push({
            imapUid: uid,
            from: msg.envelope.from?.text || "Unknown",
            subject: msg.envelope.subject || "No Subject",
            date: receivedAt,
            text: null,  // Preview ไม่ต้องการเนื้อหา
            html: null,   // Preview ไม่ต้องการ HTML
            attachments: attachments, // ✅ ข้อมูลไฟล์แนบ (ไม่มีตัวไฟล์จริง)
            size: msg.size || 0,
          });
        } catch (msgErr) {}
      }
      return previewEmails;
    }

    // ดึงอีเมลทีละฉบับตาม UID ที่ได้มา (normal mode)
    const uidsToFetch = limit !== null ? lastUids.slice(0, limit) : lastUids;
    let savedCount = 0;
    let existingCount = 0;

    for (const uid of uidsToFetch) {
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
          if (
            (startFilter && receivedAt < startFilter) ||
            (endFilter && receivedAt > endFilter)
          )
            continue;
        }

        // เช็คก่อนว่า UID นี้เคยเก็บแล้วหรือยัง
        const exists = await prisma.email.findUnique({
          where: { imapUid: uid },
        });
        if (exists) {
          existingCount += 1;
          continue;
        }

        const email = await prisma.email.create({
          // นำข้อมูลไป Insert ลงในตาราง email
          data: {
            imapUid: uid,
            fromEmail: parsed.from?.text || "",
            subject: parsed.subject || "",
            bodyText: parsed.text || "",
            receivedAt: parsed.date || new Date(),
            accountId: accountConfig?.id || null,
          },
        });

        savedCount += 1;

        // มี attachments?
        if (parsed.attachments?.length) {
          const dir = path.join(__dirname, "../../storage", email.id);
          fs.mkdirSync(dir, { recursive: true });

          for (const file of parsed.attachments) {
            try {
              const filePath = path.join(dir, file.filename);
              fs.writeFileSync(filePath, file.content); // บันทึกไฟล์จริงลงใน Disk

              await prisma.attachment.create({
                // สร้างประวัติไฟล์แนบในฐานข้อมูล
                data: {
                  emailId: email.id,
                  fileName: file.filename,
                  fileType: file.contentType,
                  filePath,
                },
              });
            } catch (fileErr) {
              log(`❌ Attachment save failed (uid=${uid}, filename=${file?.filename || 'unknown'}): ${fileErr?.message || fileErr}`);
            }
          }
        }
      } catch (emailErr) {
        log(`❌ Email fetch/parse/save failed (uid=${uid}): ${emailErr?.message || emailErr}`);
      }
    }
    await client.logout(); // ปิด Session

    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
      dateFilter.gte.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
      dateFilter.lte.setHours(23, 59, 59, 999);
    }

    const emailIds = await prisma.email.findMany({
      where: {
        receivedAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      select: { id: true },
    });

    if (returnMeta) {
      return {
        totalUids: lastUids.length,
        fetchedUids: uidsToFetch.length,
        savedCount,
        existingCount,
        emailIds,
      };
    }

    return emailIds;
  } catch (err) {
    throw err;
  }
}

async function fetchEmailByUid(uid, accountConfig = null) {
  const config = accountConfig || {
    host: process.env.IMAP_HOST,
    port: process.env.IMAP_PORT,
    secure: true,
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
  };
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    const msg = await client.fetchOne(uid, {
      source: true,
      bodyStructure: true,
      envelope: true,
    });
    return await simpleParser(msg.source);
  } finally {
    try {
      await client.logout();
    } catch (e) {}
  }
}

module.exports = { fetchEmails, fetchEmailByUid };
