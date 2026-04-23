const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");
const prisma = require("../utils/prisma");
//ฟังก์ชันสำหรับสร้าง ImapFlow connection ใหม่
function createImapConnection(config) {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    timeout: 60000, // 60 วินาที
    connectionTimeout: 60000, // 60 วินาที
    authTimeout: 30000, // 30 วินาที
    maxIdleTime: 300000, // 5 นาที
  });
}

//ฟังก์ชันสำหรับเชื่อมต่อ IMAP พร้อม retry
async function connectWithRetry(client, config, maxRetries = 3) {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      if (!client.usable) {
        // สร้าง connection ใหม่ถ้าเสียแล้ว
        client = createImapConnection(config);
      }
      
      await client.connect();
      await client.mailboxOpen("INBOX");
      
      if (!client.usable) {
        throw new Error('Connection not usable after connect');
      }
      
      return client;
    } catch (error) {
      retryCount++;
      
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to connect after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Delay ก่อน retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // สร้าง connection ใหม่สำหรับ retry ถัดไป
      try {
        await client.logout();
      } catch (e) {} // ละเว้น error จาก logout
      
      client = createImapConnection(config);
    }
  }
}

//ฟังก์ชันสำหรับเชื่อมต่อและดึงข้อมูลอีเมล ผ่านไลบรารีที่ชื่อว่า Imapflow
async function fetchEmails(startDate, endDate, accountConfig = null, options = {}, filterMode = 'ALL') {
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
  const offset = Number.isFinite(options.offset) ? Math.max(0, options.offset) : 0;
  const returnMeta = !!options.returnMeta;
  const log = typeof options.logger === 'function' ? options.logger : console.log;

  let client = createImapConnection(config);

  try {
    // เชื่อมต่อกับเซิร์ฟเวอร์อีเมล และเปิดกล่องจดหมาย INBOX พร้อม retry
    client = await connectWithRetry(client, config);
    log(`📧 IMAP connected successfully to ${config.host}:${config.port}`);

    let searchQuery = { all: true }; // ค่าเริ่มต้น
  
  if (filterMode === 'JOB_ONLY') {
    searchQuery = {
      or: [
        { subject: "สมัครงาน" },
        { subject: "Resume" },
        { subject: "CV" },
        { subject: "Job Application" },
        { subject: "resume" },
        { subject: "cv" },
        { subject: "job application" }
      ]
    };
  }

    log(`📧 fetchEmails params: startDate=${startDate || '-'} endDate=${endDate || '-'} filterMode=${filterMode}`);

    if (startDate || endDate) {
      if (filterMode === 'JOB_ONLY') {
        searchQuery = {
          and: [
            searchQuery,
            {}
          ]
        };
        
        if (startDate) {
          const startThaiDate = new Date(startDate);
          // ถอยหลังไป 1 วันสำหรับ IMAP Search เพื่อให้ครอบคลุมเวลาไทยที่เร็วกว่า UTC
          const safetyDate = new Date(startThaiDate);
          safetyDate.setDate(safetyDate.getDate() - 1);
          const y = safetyDate.getFullYear();
          const m = String(safetyDate.getMonth() + 1).padStart(2, "0");
          const d = String(safetyDate.getDate()).padStart(2, "0");
          searchQuery.and[1].since = `${y}-${m}-${d}`;
        }
        if (endDate) {
          const endThaiDate = new Date(endDate);
          endThaiDate.setDate(endThaiDate.getDate() + 1);
          const y = endThaiDate.getFullYear();
          const m = String(endThaiDate.getMonth() + 1).padStart(2, "0");
          const d = String(endThaiDate.getDate()).padStart(2, "0");
          searchQuery.and[1].before = `${y}-${m}-${d}`;
        }
      } else {
        // ALL mode - ใช้ date filter โดยตรง
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

    // ดึง UID ทั้งหมดที่มีในฐานข้อมูลมาครั้งเดียว (Batch Query Optimization)
    log(`📧 Loading existing UIDs from database for batch check...`);
    const existingUids = await prisma.email.findMany({
      where: { imapUid: { in: lastUids } },
      select: { imapUid: true }
    });
    const existingUidSet = new Set(existingUids.map(e => e.imapUid));
    log(`📧 Found ${existingUidSet.size} existing UIDs in database`);

    // ดึงอีเมลทีละฉบับตาม UID ที่ได้มา (normal mode)
    const uidsWindow = limit !== null ? lastUids.slice(offset, offset + limit) : lastUids.slice(offset);
    const uidsToFetch = uidsWindow.filter((uid) => !existingUidSet.has(uid));
    log(`📧 Starting to fetch ${uidsToFetch.length} emails (offset=${offset}, limit=${limit})...`);
    log(`📧 Skipped ${uidsWindow.length - uidsToFetch.length} emails already in database`);

    // อัปเดต fetching progress เริ่มต้น
    if (global.updateFetchingProgress) {
      global.updateFetchingProgress('กำลังดึงอีเมล...', uidsToFetch.length, 0);
    }

    let savedCount = 0;
    let existingCount = 0;
    let fetchedCount = 0; // นับจำนวนที่ดึงมาแล้ว
    let dateFilteredCount = 0;
    let connectionErrors = 0;
    const maxConnectionErrors = 5; // จำกัด connection errors

    for (const uid of uidsToFetch) {
      try {
        // อัปเดต fetching progress ก่อนดึงอีเมล
        fetchedCount++;
        if (global.updateFetchingProgress) {
          global.updateFetchingProgress(`กำลังดึงอีเมล UID ${uid}...`, uidsToFetch.length, fetchedCount);
        }

        // ตรวจสอบ connection ก่อน fetch แต่ละ email
        if (!client.usable) {
          log(`❌ Connection lost before fetching UID ${uid}, attempting to reconnect...`);
          
          try {
            client = await connectWithRetry(client, config);
            log(`✅ Reconnected successfully for UID ${uid}`);
          } catch (reconnectErr) {
            connectionErrors++;
            log(`❌ Failed to reconnect for UID ${uid}: ${reconnectErr.message}`);
            
            if (connectionErrors >= maxConnectionErrors) {
              throw new Error(`Too many connection errors (${connectionErrors}). Aborting fetch.`);
            }
            continue; // ข้าม UID นี้และไปต่อ
          }
        }

        const msg = await client.fetchOne(uid, { source: true });
        const parsed = await simpleParser(msg.source); // simpleParser จะทำหน้าที่ ถอดรหัส ให้กลายเป็น Object
        
        // กรองอีเมลสมัครงานก่อนบันทึก (Process Filtering)
        const subject = (parsed.subject || "").toLowerCase();
        const body = (parsed.text || "").toLowerCase();
        const isJobRelated = subject.includes("สมัครงาน") || 
                           subject.includes("resume") || 
                           subject.includes("cv") ||
                           subject.includes("job application") ||
                           body.includes("สมัครงาน") ||
                           body.includes("resume") ||
                           body.includes("job application");

        if (!isJobRelated) {
          log(`⏭️ Skipped non-job email: ${subject}`);
          continue; // ข้ามไปอีเมลฉบับถัดไปเลย ไม่บันทึก ไม่ทำ OCR
        }

        // อัปเดต fetching progress ด้วย subject หลังจาก parse เสร็จ
        if (global.updateFetchingProgress) {
          const subject = parsed.subject || '(ไม่มีหัวข้อ)';
          global.updateFetchingProgress(subject, uidsToFetch.length, fetchedCount);
        }

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
          {
            dateFilteredCount += 1;
            continue;
          }
        }

        const email = await prisma.email.create({
          // นำข้อมูลไป Insert ลงในตาราง email
          data: {
            imapUid: uid,
            fromEmail: parsed.from?.text || "",
            subject: parsed.subject || "",
            bodyText: parsed.text || "",
            receivedAt: parsed.date || new Date(),
            accountId: accountConfig?.id,
          },
        });

        savedCount += 1;

        // อัปเดต progress ทุกครั้งที่บันทึกอีเมลสำเร็จ
        if (global.updateSavingProgress) {
          global.updateSavingProgress(parsed.subject || '(ไม่มีหัวข้อ)', savedCount, uidsToFetch.length);
        }

        // มี attachments?
        if (parsed.attachments?.length) {
          const storageService = require('./storage.service');
          
          for (const file of parsed.attachments) {
            try {
              // อัปโหลดไฟล์ไป Supabase Storage
              const fallbackFilename = file.filename || `unknown_${Date.now()}`;
              const uploadResult = await storageService.uploadAttachment(
                null, // ไม่มี local path
                fallbackFilename,
                accountConfig?.userId || '00000000-0000-0000-0000-000000000001', // ใช้ userId ของ account หรือ admin
                email.id,
                file.content, // ส่ง buffer ของไฟล์
                file.contentType // ส่ง MIME type ด้วย
              );
              
              // สร้าง attachment record ใน database
              const attachment = await prisma.attachment.create({
                data: {
                  emailId: email.id,
                  fileName: fallbackFilename, // Fallback filename if undefined
                  originalFileName: file.filename, // เก็บชื่อไฟล์ต้นฉบับภาษาไทย
                  fileType: file.contentType,
                  filePath: uploadResult.path, // UUID-based path
                  cloudPath: uploadResult.path, // UUID-based path
                  cloudProvider: 'supabase',
                  size: file.content.length,
                  userId: email.userId || accountConfig?.userId // ใช้ userId จาก email ก่อน
                },
              });

              // Trigger OCR สำหรับ PDF และไฟล์ภาพ (Attachment Filtering)
              // ตรวจสอบขนาดไฟล์ร่วมด้วย (เช่น > 50KB) เพื่อเลี่ยงพวก icon เล็กๆ ในอีเมล
              if (file.contentType && 
                  (file.contentType.includes('pdf') || file.contentType.includes('image/')) && 
                  file.content.length > 50000) {
                try {
                  const { processAttachment } = require('./attachment-ocr.service');
                  // Trigger OCR ใน background ไม่ต้องรอผล
                  processAttachment(attachment).catch(err => {
                    console.log(`⚠️ OCR failed for attachment ${attachment.id}:`, err?.message || err);
                  });
                } catch (ocrErr) {
                  console.log(`⚠️ Failed to trigger OCR for attachment ${attachment.id}:`, ocrErr?.message || ocrErr);
                }
              } else if (file.contentType && (file.contentType.includes('pdf') || file.contentType.includes('image/'))) {
                log(`⏭️ Skipped small attachment for OCR: ${file.filename} (${file.content.length} bytes)`);
              }
            } catch (fileErr) {
              log(`❌ Attachment save failed (uid=${uid}, filename=${file?.filename || 'unknown'}): ${fileErr?.message || fileErr}`);
            }
          }
        }

      } catch (emailErr) {
        log(`❌ Email fetch/parse/save failed (uid=${uid}): ${emailErr?.message || emailErr}`);
        
        // ถ้าเป็น connection error เพิ่ม counter
        if (emailErr.message?.includes('Connection') || 
            emailErr.message?.includes('not available') ||
            emailErr.code === 'NoConnection') {
          connectionErrors++;
          
          if (connectionErrors >= maxConnectionErrors) {
            throw new Error(`Too many connection errors (${connectionErrors}). Aborting fetch.`);
          }
        }
      }
    }

    // Logout อย่างปลอดภัย
    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (logoutErr) {
      log(`⚠️ Logout failed: ${logoutErr.message}`);
    }

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
    // Cleanup connection on error
    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (cleanupErr) {
      // ละเว้น cleanup error
    }
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
