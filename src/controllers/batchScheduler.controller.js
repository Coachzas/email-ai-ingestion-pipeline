const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { 
  startBatchProgress, 
  completeBatchProgress, 
  createBatchLogger,
  updateFetchingProgress,
  updateSavingProgress,
  updateOcrProgress
} = require('./batch-progress.controller');

const prisma = new PrismaClient();
const activeJobs = new Map();

// สร้าง Batch Scheduler
exports.createScheduler = async (req, res) => {
  try {
    const {
      name,
      batchSize,
      scheduleType,
      customHour,
      customMinute,
      startDate,
      endDate
    } = req.body;

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'startDate ไม่ถูกต้อง (ต้องเป็นวันที่ที่ถูกต้อง)',
      });
    }

    if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'endDate ไม่ถูกต้อง (ต้องเป็นวันที่ที่ถูกต้อง)',
      });
    }

    // แปลง scheduleType ให้ตรงกับ enum
    const scheduleTypeEnum = scheduleType.toUpperCase();

    // คำนวณ next run time
    const nextRunAt = calculateNextRunTime(scheduleTypeEnum, customHour, customMinute);

    const scheduler = await prisma.batchScheduler.create({
      data: {
        name,
        batchSize,
        scheduleType: scheduleTypeEnum,
        customHour: scheduleTypeEnum === 'CUSTOM' ? customHour : null,
        customMinute: scheduleTypeEnum === 'CUSTOM' ? customMinute : null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        nextRunAt
      }
    });

    // เริ่ม cron job ถ้า scheduler active
    if (scheduler.isActive) {
      startCronJob(scheduler);
    }

    console.log(`✅ Created scheduler: ${scheduler.name}`);

    res.status(201).json({
      success: true,
      message: 'สร้าง Batch Scheduler สำเร็จ',
      data: scheduler
    });
  } catch (error) {
    console.error('Error creating scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง Batch Scheduler',
      error: error.message
    });
  }
};

// ดึงข้อมูล Batch Scheduler ทั้งหมด
exports.getAllSchedulers = async (req, res) => {
  try {
    const schedulers = await prisma.batchScheduler.findMany({
      include: {
        batchRuns: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: schedulers
    });
  } catch (error) {
    console.error('Error fetching schedulers:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Batch Scheduler',
      error: error.message
    });
  }
};

// อัปเดต Batch Scheduler
exports.updateScheduler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      batchSize,
      scheduleType,
      customHour,
      customMinute,
      startDate,
      endDate
    } = req.body;

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'startDate ไม่ถูกต้อง (ต้องเป็นวันที่ที่ถูกต้อง)',
      });
    }

    if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'endDate ไม่ถูกต้อง (ต้องเป็นวันที่ที่ถูกต้อง)',
      });
    }

    // แปลง scheduleType ให้ตรงกับ enum
    const scheduleTypeEnum = scheduleType.toUpperCase();

    // คำนวณ next run time
    const nextRunAt = calculateNextRunTime(scheduleTypeEnum, customHour, customMinute);

    // ตรวจสอบว่า scheduler มีอยู่จริง
    const existingScheduler = await prisma.batchScheduler.findUnique({
      where: { id }
    });

    if (!existingScheduler) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ scheduler นี้',
      });
    }

    const scheduler = await prisma.batchScheduler.update({
      where: { id },
      data: {
        name,
        batchSize,
        scheduleType: scheduleTypeEnum,
        customHour: scheduleTypeEnum === 'CUSTOM' ? customHour : null,
        customMinute: scheduleTypeEnum === 'CUSTOM' ? customMinute : null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        nextRunAt
      }
    });

    // หยุด cron job เก่าและเริ่มใหม่ถ้า active
    if (scheduler.isActive) {
      stopCronJob(scheduler.id);
      startCronJob(scheduler);
    }

    console.log(`✅ Updated scheduler: ${scheduler.name}`);

    res.json({
      success: true,
      message: 'อัปเดต Batch Scheduler สำเร็จ',
      data: scheduler
    });
  } catch (error) {
    console.error('Error updating scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดต Batch Scheduler',
      error: error.message
    });
  }
};

// ลบ Batch Scheduler
exports.deleteScheduler = async (req, res) => {
  try {
    const { id } = req.params;

    // หยุด cron job ก่อนลบ
    stopCronJob(id);

    // ตรวจสอบว่ามี batch runs หรือไม่
    const batchRunsCount = await prisma.batchRun.count({
      where: { schedulerId: id }
    });

    if (batchRunsCount > 0) {
      // ถ้ามี batch runs ต้องลบก่อนถึงจะลบ scheduler ได้
      await prisma.batchRun.deleteMany({
        where: { schedulerId: id }
      });
    }

    await prisma.batchScheduler.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: batchRunsCount > 0 
        ? `ลบ Batch Scheduler และ batch runs จำนวน ${batchRunsCount} รอบ สำเร็จ`
        : 'ลบ Batch Scheduler สำเร็จ'
    });
  } catch (error) {
    console.error('Error deleting scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ Batch Scheduler',
      error: error.message
    });
  }
};

// เริ่ม cron job
function startCronJob(scheduler) {
  // หยุด job เก่าถ้ามี
  stopCronJob(scheduler.id);

  let cronExpression;

  switch (scheduler.scheduleType) {
    case 'DAILY':
      cronExpression = scheduler.customHour !== null && scheduler.customMinute !== null
        ? `${scheduler.customMinute} ${scheduler.customHour} * * *`
        : '0 0 * * *'; // ค่าเริ่มต้น 00:00
      break;
    case 'HOURLY':
      cronExpression = '0 * * * *';
      break;
    case 'CUSTOM':
      cronExpression = `${scheduler.customMinute} ${scheduler.customHour} * * *`;
      break;
    default:
      console.error(`❌ Unknown schedule type: ${scheduler.scheduleType}`);
      return;
  }

  console.log(`🕐 Setting up cron job for "${scheduler.name}":`);
  console.log(`   📅 Schedule Type: ${scheduler.scheduleType}`);
  console.log(`   ⏰ Cron Expression: ${cronExpression}`);
  console.log(`   🎯 Next Run: ${scheduler.nextRunAt}`);

  const task = cron.schedule(cronExpression, async () => {
    console.log(`⏰ [${new Date().toLocaleString('th-TH')}] Cron job triggered for: ${scheduler.name}`);
    await executeBatch(scheduler);
  }, {
    scheduled: true,
    timezone: 'Asia/Bangkok'
  });

  activeJobs.set(scheduler.id, task);
  console.log(`✅ Started cron job for scheduler: ${scheduler.name} (${cronExpression})`);
}

// หยุด cron job
function stopCronJob(schedulerId) {
  const job = activeJobs.get(schedulerId);
  if (job) {
    job.stop();
    activeJobs.delete(schedulerId);
    console.log(`Stopped cron job for scheduler: ${schedulerId}`);
  }
}

// ทำงาน batch - บันทึกอีเมลจริงใน Database
async function executeBatch(scheduler) {
  const logger = createBatchLogger();
  
  try {
    console.log(`🚀 Executing batch for scheduler: ${scheduler.name}`);

    // สร้าง batch run record
    const batchRun = await prisma.batchRun.create({
      data: {
        schedulerId: scheduler.id,
        batchNumber: await getNextBatchNumber(scheduler.id),
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    // อัปเดต last run และ next run
    const nextRunAt = calculateNextRunTime(
      scheduler.scheduleType,
      scheduler.customHour,
      scheduler.customMinute
    );

    await prisma.batchScheduler.update({
      where: { id: scheduler.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt
      }
    });

    // เริ่มต้น progress tracking
    await startBatchProgress(scheduler.batchSize);

    // โหลดบัญชีอีเมลที่เลือกไว้ (ระบบเก่าใช้ isSelected=true)
    const account = await prisma.emailAccount.findFirst({
      where: {
        status: 'ACTIVE',
        isSelected: true,
      },
      select: {
        id: true,
        host: true,
        port: true,
        secure: true,
        username: true,
        password: true,
      }
    });

    if (!account) {
      throw new Error('No active selected email account found. Please select an email account first.');
    }

    const accountConfig = {
      id: account.id,
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: {
        user: account.username,
        pass: account.password,
      },
    };

    // เชื่อมต่อ IMAP จริงและดึงอีเมลทั้งหมด (ระบบเก่าจะบันทึกลง DB โดยเช็ค UID ซ้ำให้แล้ว)
    console.log(`📧 Connecting to IMAP to fetch emails...`);
    
    const batchEndDate = scheduler.endDate ? new Date(scheduler.endDate) : new Date();
    let fetchResult;
    try {
      // ใช้ fetchEmails แบบดึงจริง ไม่ใช่ preview
      const { fetchEmails } = require('../services/imap.service');
      
      // อัปเดต progress ว่ากำลังดึงอีเมล
      updateFetchingProgress(`กำลังดึงอีเมลจาก ${scheduler.startDate} ถึง ${batchEndDate.toLocaleDateString('th-TH')}`, scheduler.batchSize);
      
      // ดึงอีเมลและให้ service บันทึกลง DB จริง (เช็ค UID ไม่ซ้ำ)
      // ใช้ limit เพื่อทำงานตาม batchSize
      fetchResult = await fetchEmails(
        scheduler.startDate,
        batchEndDate,
        accountConfig,
        {
          limit: scheduler.batchSize,
          returnMeta: true,
          logger: (msg) => logger.log(`[IMAP] ${msg}`)
        }
      );

      console.log(`📧 IMAP fetch done: totalUids=${fetchResult?.totalUids ?? 0}, fetchedUids=${fetchResult?.fetchedUids ?? 0}, saved=${fetchResult?.savedCount ?? 0}, existing=${fetchResult?.existingCount ?? 0}`);
      
      // อัปเดต progress ช่วงการบันทึก
      updateSavingProgress(`บันทึกอีเมลลงฐานข้อมูล`, fetchResult?.savedCount ?? 0, scheduler.batchSize);

    } catch (error) {
      console.error('❌ IMAP connection failed:', error);
      throw new Error(`ไม่สามารถเชื่อมต่ออีเมลได้: ${error.message}`);
    }

    const emailsProcessed = fetchResult?.savedCount ?? 0;

    console.log(`📧 Batch result: saved ${emailsProcessed} new emails (batch size: ${scheduler.batchSize})`);
    if (!emailsProcessed) {
      console.log(`ℹ️ No new emails saved. (either no emails in date range, or all UIDs already exist in DB)`);
    } else {
      console.log(`📋 Emails will appear in Email Review Center`);
      
      // 🔄 เริ่มทำ OCR/Extract อัตโนมัติสำหรับอีเมลใหม่ทั้งหมด
      console.log(`🔍 Starting automatic OCR/Extract for ${emailsProcessed} new emails...`);
      updateOcrProgress('กำลังเริ่ม OCR/Extract', 0, 0);
      
      try {
        const { processAttachmentsForNewEmails } = require('../services/attachment-ocr.service');
        const ocrResult = await processAttachmentsForNewEmails();
        
        if (ocrResult.success) {
          console.log(`✅ OCR/Extract completed: ${ocrResult.processed} files processed, ${ocrResult.errors} errors`);
          updateOcrProgress('OCR/Extract เสร็จสิ้น', ocrResult.processed, ocrResult.processed);
        } else {
          console.log(`⚠️ OCR/Extract completed with some issues: ${ocrResult.message}`);
          updateOcrProgress('OCR/Extract เสร็จสิ้น (มีปัญหาบางส่วน)', ocrResult.processed || 0, ocrResult.processed || 0);
        }
      } catch (ocrError) {
        console.error(`❌ OCR/Extract failed:`, ocrError);
        updateOcrProgress('OCR/Extract ล้มเหลว', 0, 0);
        // ไม่ทำให้ batch ล้มเหลว แค่ log error
      }
    }

    // อัปเดต batch run ว่า completed
    await prisma.batchRun.update({
      where: { id: batchRun.id },
      data: {
        status: 'COMPLETED',
        emailsProcessed,
        completedAt: new Date()
      }
    });

    console.log(`✅ Batch completed: ${emailsProcessed} emails processed and saved to database`);

    // Complete progress tracking
    completeBatchProgress();

    return {
      batchRunId: batchRun.id,
      schedulerId: scheduler.id,
      schedulerName: scheduler.name,
      totalUids: fetchResult?.totalUids ?? 0,
      fetchedUids: fetchResult?.fetchedUids ?? 0,
      savedCount: fetchResult?.savedCount ?? 0,
      existingCount: fetchResult?.existingCount ?? 0,
      emailsProcessed,
    };

  } catch (error) {
    console.error(`❌ Batch execution failed for scheduler ${scheduler.name}:`, error);

    // อัปเดต batch run ว่า failed
    try {
      await prisma.batchRun.updateMany({
        where: {
          schedulerId: scheduler.id,
          status: 'RUNNING'
        },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date()
        }
      });
    } catch (updateError) {
      console.error('Failed to update batch run status:', updateError);
    }

    // Complete progress with error
    completeBatchProgress();
    
    throw error;
  } finally {
    logger.restore();
  }
}

// รัน scheduler ทันที (ไม่ต้องรอ cron)
exports.runSchedulerNow = async (req, res) => {
  try {
    const { id } = req.params;
    const scheduler = await prisma.batchScheduler.findUnique({ where: { id } });

    if (!scheduler) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ scheduler นี้',
      });
    }

    const result = await executeBatch(scheduler);

    return res.json({
      success: true,
      message: 'รัน batch สำเร็จ',
      data: result,
    });
  } catch (error) {
    console.error('Error running scheduler now:', error);
    return res.status(500).json({
      success: false,
      message: 'รัน batch ไม่สำเร็จ',
      error: error.message,
    });
  }
};

// คำนวณ batch number ถัดไป
async function getNextBatchNumber(schedulerId) {
  try {
    const lastBatch = await prisma.batchRun.findFirst({
      where: { schedulerId },
      orderBy: { batchNumber: 'desc' }
    });

    return lastBatch ? lastBatch.batchNumber + 1 : 1;
  } catch (error) {
    console.error('Error getting next batch number:', error);
    return 1;
  }
}

// คำนวณเวลาที่จะรันครั้งถัดไป
function calculateNextRunTime(scheduleType, customHour, customMinute) {
  const now = new Date();
  const next = new Date(now);

  switch (scheduleType) {
    case 'DAILY':
      next.setHours(customHour !== undefined && customHour !== null ? customHour : 0, 
                   customMinute !== undefined && customMinute !== null ? customMinute : 0, 0, 0);
      if (next <= now) {
        next.setDate(now.getDate() + 1);
      }
      break;
    case 'HOURLY':
      next.setHours(now.getHours() + 1, 0, 0, 0);
      break;
    case 'CUSTOM':
      next.setHours(customHour !== undefined && customHour !== null ? customHour : 0, 
                   customMinute !== undefined && customMinute !== null ? customMinute : 0, 0, 0);
      if (next <= now) {
        next.setDate(now.getDate() + 1);
      }
      break;
  }

  return next;
}

// เริ่ม schedulers ทั้งหมดเมื่อ server start
exports.initializeSchedulers = async () => {
  try {
    const schedulers = await prisma.batchScheduler.findMany({
      where: { isActive: true }
    });

    console.log(`Found ${schedulers.length} active schedulers in database`);

    for (const scheduler of schedulers) {
      startCronJob(scheduler);
    }

    console.log(`✅ Initialized ${schedulers.length} schedulers from database`);
  } catch (error) {
    console.error('❌ Error initializing schedulers:', error);
  }
};

// GET สถานะ batch ทั้งหมด
exports.getBatchStatus = async (req, res) => {
  try {
    const schedulers = await prisma.batchScheduler.findMany({
      where: { isActive: true },
      include: {
        batchRuns: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    const recentRuns = await prisma.batchRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        scheduler: {
          select: { name: true }
        }
      }
    });

    const status = {
      activeSchedulers: schedulers,
      activeJobs: Array.from(activeJobs.entries()).map(([id, job]) => ({
        schedulerId: id,
        schedulerName: schedulers.find(s => s.id === id)?.name || 'Unknown',
        isRunning: true
      })),
      recentRuns,
      totalSchedulers: schedulers.length,
      totalRuns: recentRuns.length
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting batch status:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถานะ batch',
      error: error.message
    });
  }
};

// ตั้งค่า Active Scheduler เดียว
exports.setActiveScheduler = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ตรวจสอบว่า scheduler ที่จะเปลี่ยนเป็น active หรือ inactive
    const targetScheduler = await prisma.batchScheduler.findUnique({
      where: { id }
    });
    
    if (!targetScheduler) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ scheduler นี้',
      });
    }
    
    if (targetScheduler.isActive) {
      // ถ้าเป็น active อยู่แล้ว ให้ inactive ตัวเดียวนี้
      await prisma.batchScheduler.update({
        where: { id },
        data: { isActive: false }
      });
      
      // หยุด cron job ของตัวนี้
      stopCronJob(id);
      
      console.log(`✅ Inactive scheduler: ${targetScheduler.name}`);
      
      res.json({
        success: true,
        message: `Inactive "${targetScheduler.name}" สำเร็จ`,
        data: { ...targetScheduler, isActive: false }
      });
    } else {
      // ถ้าเป็น inactive ให้ active ตัวนี้ และ inactive ทุกตัวอื่น
      const allSchedulers = await prisma.batchScheduler.findMany({
        where: { isActive: true }
      });
      
      for (const scheduler of allSchedulers) {
        stopCronJob(scheduler.id);
      }
      
      // ตั้งค่าทุก scheduler เป็น inactive
      await prisma.batchScheduler.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
      
      // ตั้งค่า scheduler ที่เลือกเป็น active
      const scheduler = await prisma.batchScheduler.update({
        where: { id },
        data: { isActive: true }
      });
      
      // เริ่ม cron job ใหม่สำหรับ scheduler ที่เลือก
      startCronJob(scheduler);
      
      console.log(`✅ Set "${scheduler.name}" as the only active scheduler`);
      
      res.json({
        success: true,
        message: `ตั้ง "${scheduler.name}" เป็น Active Scheduler ตัวเดียวสำเร็จ`,
        data: scheduler
      });
    }
  } catch (error) {
    console.error('Error setting active scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตั้ง Active Scheduler',
      error: error.message
    });
  }
};

// ทดสอบการเชื่อมต่อ IMAP
exports.testImapConnection = async (req, res) => {
  try {
    const config = {
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT) || 993,
      secure: true,
      username: process.env.IMAP_USER,
      password: process.env.IMAP_PASS
    };

    if (!config.username || !config.password) {
      return res.json({
        success: false,
        message: 'ไม่พบข้อมูล IMAP ใน .env',
        config: {
          host: config.host,
          port: config.port,
          hasUsername: !!config.username,
          hasPassword: !!config.password
        }
      });
    }

    console.log('🔍 Testing IMAP connection...');
    
    // ทดสอบการเชื่อมต่อ
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      timeout: 10000,
    });

    await client.connect();
    await client.mailboxOpen('INBOX');
    
    // นับจำนวนอีเมลใน INBOX
    const status = await client.status('INBOX', ['MESSAGES']);
    const messageCount = status.messages || 0;
    
    await client.logout();

    res.json({
      success: true,
      message: 'เชื่อมต่อ IMAP สำเร็จ',
      config: {
        host: config.host,
        port: config.port,
        username: config.username
      },
      messageCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ IMAP connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'ไม่สามารถเชื่อมต่อ IMAP ได้',
      error: error.message,
      config: {
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: process.env.IMAP_PORT || 993,
        hasUsername: !!process.env.IMAP_USER,
        hasPassword: !!process.env.IMAP_PASS
      }
    });
  }
};

module.exports = {
  activeJobs,
  stopCronJob,
  createScheduler: exports.createScheduler,
  updateScheduler: exports.updateScheduler,
  getAllSchedulers: exports.getAllSchedulers,
  deleteScheduler: exports.deleteScheduler,
  setActiveScheduler: exports.setActiveScheduler,
  initializeSchedulers: exports.initializeSchedulers,
  getBatchStatus: exports.getBatchStatus,
  testImapConnection: exports.testImapConnection,
  runSchedulerNow: exports.runSchedulerNow
};
