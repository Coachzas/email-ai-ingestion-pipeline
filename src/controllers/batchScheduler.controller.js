const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { 
  startBatchProgress, 
  completeBatchProgress, 
  createBatchLogger,
  updateFetchingProgress,
  updateSavingProgress,
  updateOcrProgress,
  incrementSkippedEmails
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
      endDate,
      selectedDays
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
    const nextRunAt = calculateNextRunTime(scheduleTypeEnum, customHour, customMinute, selectedDays, req.body.dayTimeSlots);

    // ตรวจสอบว่ามี scheduler ที่ active อยู่แล้วหรือไม่
    const existingActiveScheduler = await prisma.batchScheduler.findFirst({
      where: { isActive: true }
    });

    // ถ้ามี scheduler ที่ active อยู่แล้ว ให้เป็น inactive
    if (existingActiveScheduler) {
      await prisma.batchScheduler.update({
        where: { id: existingActiveScheduler.id },
        data: { isActive: false }
      });
      
      // หยุด cron job ของ scheduler เก่า
      stopCronJob(existingActiveScheduler.id);
      console.log(`🛑 Stopped cron job for scheduler: ${existingActiveScheduler.name}`);
    }

    const scheduler = await prisma.batchScheduler.create({
      data: {
        name,
        batchSize,
        scheduleType: scheduleTypeEnum,
        customHour: scheduleTypeEnum === 'CUSTOM' || scheduleTypeEnum === 'DAILY' ? customHour : null,
        customMinute: scheduleTypeEnum === 'CUSTOM' || scheduleTypeEnum === 'DAILY' ? customMinute : null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        nextRunAt,
        isActive: true, // ให้ scheduler ใหม่เป็น active โดยอัตโนมัติ
        // Store custom schedule fields as JSON
        selectedDays: scheduleTypeEnum === 'CUSTOM' ? JSON.stringify(selectedDays || []) : null,
        dayTimeSlots: scheduleTypeEnum === 'CUSTOM' ? JSON.stringify(req.body.dayTimeSlots || {}) : null
      }
    });

    // เริ่ม cron job ถ้า scheduler active
    if (scheduler.isActive) {
      startCronJob(scheduler);
    }

    console.log(`✅ Created scheduler: ${scheduler.name} (ACTIVE)`);

    res.status(201).json({
      success: true,
      message: existingActiveScheduler 
        ? `สร้าง Batch Scheduler "${scheduler.name}" สำเร็จ และเปลี่ยน "${existingActiveScheduler.name}" เป็น INACTIVE`
        : `สร้าง Batch Scheduler "${scheduler.name}" สำเร็จ (ACTIVE)`,
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
      orderBy: { createdAt: 'desc' }
    });

    // Get batch runs count and recent runs for each scheduler
    const schedulersWithStats = await Promise.all(
      schedulers.map(async (scheduler) => {
        // Get total count of batch runs
        const totalRuns = await prisma.batchRun.count({
          where: { schedulerId: scheduler.id }
        });

        // Get recent batch runs (limited to 5)
        const recentRuns = await prisma.batchRun.findMany({
          where: { schedulerId: scheduler.id },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        // Get last run info
        const lastRun = recentRuns.length > 0 ? recentRuns[0] : null;

        // Parse JSON fields for custom schedules
        const parsedScheduler = {
          ...scheduler,
          batchRuns: recentRuns,
          totalRuns,
          lastRun,
          selectedDays: scheduler.selectedDays ? JSON.parse(scheduler.selectedDays) : [],
          dayTimeSlots: scheduler.dayTimeSlots ? JSON.parse(scheduler.dayTimeSlots) : {}
        };

        return parsedScheduler;
      })
    );

    res.json({
      success: true,
      data: schedulersWithStats
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
      endDate,
      selectedDays
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
    const nextRunAt = calculateNextRunTime(scheduleTypeEnum, customHour, customMinute, selectedDays, req.body.dayTimeSlots);

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
        customHour: scheduleTypeEnum === 'CUSTOM' || scheduleTypeEnum === 'DAILY' ? customHour : null,
        customMinute: scheduleTypeEnum === 'CUSTOM' || scheduleTypeEnum === 'DAILY' ? customMinute : null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        nextRunAt,
        // Store custom schedule fields as JSON
        selectedDays: scheduleTypeEnum === 'CUSTOM' ? JSON.stringify(selectedDays || []) : null,
        dayTimeSlots: scheduleTypeEnum === 'CUSTOM' ? JSON.stringify(req.body.dayTimeSlots || {}) : null
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
      // For custom schedules, create proper cron expressions for each day and time slot
      const selectedDays = scheduler.selectedDays ? JSON.parse(scheduler.selectedDays) : [];
      const dayTimeSlots = scheduler.dayTimeSlots ? JSON.parse(scheduler.dayTimeSlots) : {};
      
      // Check if we have per-day time slots
      const hasPerDaySlots = Object.keys(dayTimeSlots).length > 0;
      
      if (hasPerDaySlots && selectedDays.length > 0) {
        // Use per-day time slots
        const dayMap = {
          'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
          'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
        };
        
        // Create multiple cron jobs for each day and its specific time slots
        const tasks = [];
        
        for (const day of selectedDays) {
          const cronDay = dayMap[day];
          const daySlots = dayTimeSlots[day] || [];
          
          for (const timeSlot of daySlots) {
            // Create cron expression: minute hour day_of_month month day_of_week
            const cronExpression = `${timeSlot.minute} ${timeSlot.hour} * * ${cronDay}`;
            
            const task = cron.schedule(cronExpression, async () => {
              console.log(`⏰ [${new Date().toLocaleString('th-TH')}] Custom cron job triggered for: ${scheduler.name} on ${day} at ${timeSlot.hour}:${timeSlot.minute}`);
              await executeBatch(scheduler);
            }, {
              scheduled: true,
              timezone: 'Asia/Bangkok'
            });
            
            tasks.push(task);
            console.log(`🕐 Created cron job for ${scheduler.name}: ${cronExpression} (${day} ${timeSlot.hour}:${timeSlot.minute})`);
          }
        }
        
        // Store all tasks for this scheduler
        activeJobs.set(scheduler.id, tasks);
        console.log(`✅ Started ${tasks.length} custom cron jobs for scheduler: ${scheduler.name} (per-day time slots on ${selectedDays.length} days)`);
        return;
      } else {
        // No time slots found - this shouldn't happen with proper UI validation
        console.error(`❌ No time slots found for custom scheduler: ${scheduler.name}`);
        return;
      }
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
  const tasks = activeJobs.get(schedulerId);
  if (tasks) {
    if (Array.isArray(tasks)) {
      // Handle multiple tasks (custom schedules)
      tasks.forEach(task => {
        task.stop();
      });
      console.log(`Stopped ${tasks.length} cron jobs for scheduler: ${schedulerId}`);
    } else {
      // Handle single task (daily/hourly schedules)
      tasks.stop();
      console.log(`Stopped cron job for scheduler: ${schedulerId}`);
    }
    activeJobs.delete(schedulerId);
  }
}

// ทำงาน batch - บันทึกอีเมลจริงใน Database
async function executeBatch(scheduler) {
  const logger = createBatchLogger();
  
  try {
    console.log(`🚀 Executing batch for scheduler: ${scheduler.name}`);

    // Create snapshot of scheduler settings at execution time
    const selectedDays = scheduler.selectedDays ? JSON.parse(scheduler.selectedDays) : null;
    const dayTimeSlots = scheduler.dayTimeSlots ? JSON.parse(scheduler.dayTimeSlots) : null;
    const schedulerConfig = {
      selectedDays,
      dayTimeSlots
    };

    // สร้าง batch run record with snapshot
    const batchRun = await prisma.batchRun.create({
      data: {
        schedulerId: scheduler.id,
        batchNumber: await getNextBatchNumber(scheduler.id),
        status: 'RUNNING',
        startedAt: new Date(),
        schedulerName: scheduler.name,
        schedulerType: scheduler.scheduleType,
        schedulerConfig: JSON.stringify(schedulerConfig)
      }
    });
    
    const nextRunAt = calculateNextRunTime(
      scheduler.scheduleType,
      scheduler.customHour,
      scheduler.customMinute,
      selectedDays,
      dayTimeSlots
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
    let totalSaved = 0;
    let totalExisting = 0;
    
    try {
      // ใช้ fetchEmails แบบดึงจริง ไม่ใช่ preview
      const { fetchEmails } = require('../services/imap.service');
      
      // อัปเดต progress ว่ากำลังดึงอีเมล
      updateFetchingProgress(`กำลังดึงอีเมลจาก ${scheduler.startDate} ถึง ${batchEndDate.toLocaleDateString('th-TH')}`, scheduler.batchSize);
      
      // ดึงอีเมลและให้ service บันทึกลง DB จริง (เช็ค UID ไม่ซ้ำ)
      // ใช้ limit เพื่อทำงานตาม batchSize และ offset เพื่อเลื่อนไปดึงอีเมลถัดไป
      let currentOffset = 0;
      let hasMoreEmails = true;
      
      while (hasMoreEmails && totalSaved < scheduler.batchSize) {
        const remainingLimit = Math.min(scheduler.batchSize - totalSaved, 100); // ดึงทีละ 100 ฉบับ
        
        fetchResult = await fetchEmails(
          scheduler.startDate,
          batchEndDate,
          accountConfig,
          {
            limit: remainingLimit,
            offset: currentOffset,
            returnMeta: true,
            logger: (msg) => logger.log(`[IMAP] ${msg}`)
          }
        );

        console.log(`📧 IMAP fetch done: totalUids=${fetchResult?.totalUids ?? 0}, fetchedUids=${fetchResult?.fetchedUids ?? 0}, saved=${fetchResult?.savedCount ?? 0}, existing=${fetchResult?.existingCount ?? 0}`);
        
        totalSaved += fetchResult?.savedCount ?? 0;
        totalExisting += fetchResult?.existingCount ?? 0;
        currentOffset += fetchResult?.fetchedUids ?? 0;
        
        // ตรวจสอบว่ามีอีเมลให้ดึงต่อหรือไม่
        hasMoreEmails = (fetchResult?.fetchedUids ?? 0) >= remainingLimit && 
                        (fetchResult?.totalUids ?? 0) > currentOffset;
        
        // หยุดถ้าดึงครบ batchSize แล้ว
        if (totalSaved >= scheduler.batchSize) {
          break;
        }
      }
      
      // อัปเดต progress ช่วงการบันทึก
      updateSavingProgress(`บันทึกอีเมลลงฐานข้อมูล`, totalSaved, scheduler.batchSize);

    } catch (error) {
      console.error('❌ IMAP connection failed:', error);
      throw new Error(`ไม่สามารถเชื่อมต่ออีเมลได้: ${error.message}`);
    }

    const emailsProcessed = totalSaved;

    console.log(`📧 Batch result: saved ${emailsProcessed} new emails (batch size: ${scheduler.batchSize})`);
    if (!emailsProcessed) {
      console.log(`ℹ️ No new emails saved. (either no emails in date range, or all UIDs already exist in DB)`);
    } else {
      console.log(`📋 Emails will appear in Email Review Center`);
      
      // 🔄 เริ่มทำ OCR/Extract อัตโนมัติสำหรับอีเมลใหม่ทั้งหมด
      console.log(`🔍 Starting automatic OCR/Extract for ${emailsProcessed} new emails...`);
      
      // กำหนด global functions สำหรับ update progress
      global.updateSavingProgress = updateSavingProgress;
      global.updateOcrProgress = updateOcrProgress;
      global.updateSkippedEmails = incrementSkippedEmails;
      
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // นับจำนวน attachments ที่ต้องทำ OCR (เฉพาะของอีเมลใหม่ที่เพิ่งบันทึก)
      const totalAttachments = await prisma.attachment.count({
        where: {
          email: {
            receivedAt: {
              gte: scheduler.startDate ? new Date(scheduler.startDate) : new Date(0),
              lte: batchEndDate
            }
          },
          OR: [
            { ocrStatus: null },
            { ocrStatus: { not: 'COMPLETED' } }
          ]
        }
      });
      
      updateOcrProgress('กำลังเริ่ม OCR/Extract', 0, totalAttachments);
      
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

    // Reset any stuck batch processing state
    const { resetBatchProgress } = require('./batch-progress.controller');
    resetBatchProgress();

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
function calculateNextRunTime(scheduleType, customHour, customMinute, selectedDays = null, dayTimeSlots = null) {
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
      // Handle custom schedule with selected days and per-day time slots
      if (!selectedDays || selectedDays.length === 0) {
        console.error(`❌ No selected days found for custom scheduler`);
        return null;
      }

      const dayMap = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
        'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
      };

      // Parse selectedDays and dayTimeSlots if they're strings
      const parsedDays = typeof selectedDays === 'string' ? JSON.parse(selectedDays) : selectedDays;
      const parsedDaySlots = typeof dayTimeSlots === 'string' ? JSON.parse(dayTimeSlots) : dayTimeSlots;

      // Check if we have per-day time slots
      const hasPerDaySlots = parsedDaySlots && Object.keys(parsedDaySlots).length > 0;
      
      if (!hasPerDaySlots) {
        console.error(`❌ No time slots found for custom scheduler`);
        return null;
      }

      // Sort selected days and convert to day numbers
      const selectedDayNumbers = parsedDays
        .map(day => dayMap[day])
        .sort((a, b) => a - b);

      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Find next run time
      let nextRun = null;
      
      // Per-day time slots logic
      for (const dayNumber of selectedDayNumbers) {
        const dayName = Object.keys(dayMap).find(key => dayMap[key] === dayNumber);
        const daySlots = parsedDaySlots[dayName] || [];
        
        if (daySlots.length === 0) continue;
        
        // If this day is today, check for future time slots
        if (dayNumber === currentDay) {
          const todaySlots = daySlots
            .map(slot => slot.hour * 60 + slot.minute)
            .filter(time => time > currentTime)
            .sort((a, b) => a - b);
          
          if (todaySlots.length > 0) {
            const nextSlot = todaySlots[0];
            nextRun = new Date(now);
            nextRun.setHours(Math.floor(nextSlot / 60), nextSlot % 60, 0, 0);
            return nextRun;
          }
        } else if (dayNumber > currentDay) {
          // Future day - use first time slot
          const firstSlot = daySlots
            .map(slot => slot.hour * 60 + slot.minute)
            .sort((a, b) => a - b)[0];
          
          nextRun = new Date(now);
          nextRun.setDate(nextRun.getDate() + (dayNumber - currentDay));
          nextRun.setHours(Math.floor(firstSlot / 60), firstSlot % 60, 0, 0);
          return nextRun;
        }
      }
      
      // If no future day found this week, go to next week
      const nextDay = selectedDayNumbers[0];
      const dayName = Object.keys(dayMap).find(key => dayMap[key] === nextDay);
      const daySlots = parsedDaySlots[dayName] || [];
      
      if (daySlots.length > 0) {
        const firstSlot = daySlots
          .map(slot => slot.hour * 60 + slot.minute)
          .sort((a, b) => a - b)[0];
        
        nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + (7 - currentDay + nextDay));
        nextRun.setHours(Math.floor(firstSlot / 60), firstSlot % 60, 0, 0);
        return nextRun;
      }
      
      console.error(`❌ No valid time slots found for any selected day`);
      return null;
    default:
      console.error(`❌ Unknown schedule type: ${scheduleType}`);
      return null;
  }

  return next;
}

// GET สถานะ batch ทั้งหมด
exports.getBatchStatus = async (req, res) => {
  try {
    const schedulers = await prisma.batchScheduler.findMany({
      where: { isActive: true }
    });

    // Get batch runs count and recent runs for each active scheduler
    const schedulersWithStats = await Promise.all(
      schedulers.map(async (scheduler) => {
        // Get recent batch runs (limited to 5)
        const recentRuns = await prisma.batchRun.findMany({
          where: { schedulerId: scheduler.id },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        return {
          ...scheduler,
          batchRuns: recentRuns
        };
      })
    );

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
      activeSchedulers: schedulersWithStats,
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

// ดึงประวัติการรัน batch ทั้งหมด
exports.getBatchHistory = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // ดึง batch runs พร้อมข้อมูล scheduler และ snapshot
    const batchRuns = await prisma.batchRun.findMany({
      include: {
        scheduler: {
          select: {
            id: true,
            name: true,
            batchSize: true,
            scheduleType: true,
            startDate: true,
            endDate: true,
            selectedDays: true,
            dayTimeSlots: true,
            customHour: true,
            customMinute: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Parse JSON fields and use snapshot for historical accuracy
    const formattedRuns = batchRuns.map(run => {
      // Use snapshot data if available, otherwise fall back to current scheduler data
      let selectedDays = [];
      let dayTimeSlots = {};
      
      if (run.schedulerConfig) {
        // Use snapshot from execution time
        const config = JSON.parse(run.schedulerConfig);
        selectedDays = config.selectedDays || [];
        dayTimeSlots = config.dayTimeSlots || {};
      } else if (run.scheduler) {
        // Fallback to current scheduler data (for old runs without snapshot)
        selectedDays = run.scheduler.selectedDays ? JSON.parse(run.scheduler.selectedDays) : [];
        dayTimeSlots = run.scheduler.dayTimeSlots ? JSON.parse(run.scheduler.dayTimeSlots) : {};
      }
      
      return {
        ...run,
        scheduler: run.scheduler ? {
          ...run.scheduler,
          selectedDays,
          dayTimeSlots
        } : null,
        // Keep snapshot fields for reference
        schedulerName: run.schedulerName,
        schedulerType: run.schedulerType,
        schedulerConfig: run.schedulerConfig
      };
    });

    // Get total count for pagination
    const totalCount = await prisma.batchRun.count();

    res.json({
      success: true,
      data: formattedRuns,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching batch history:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงประวัติการรัน batch',
      error: error.message
    });
  }
};

module.exports = {
  createScheduler: exports.createScheduler,
  updateScheduler: exports.updateScheduler,
  getAllSchedulers: exports.getAllSchedulers,
  deleteScheduler: exports.deleteScheduler,
  setActiveScheduler: exports.setActiveScheduler,
  initializeSchedulers: exports.initializeSchedulers,
  getBatchStatus: exports.getBatchStatus,
  runSchedulerNow: exports.runSchedulerNow,
  getBatchHistory: exports.getBatchHistory
};
