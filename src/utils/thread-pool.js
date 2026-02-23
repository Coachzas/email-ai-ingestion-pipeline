const { Piscina } = require('piscina');
const path = require('path');

// สร้าง Thread Pool สำหรับ OCR
const ocrPool = new Piscina({
  filename: path.join(__dirname, '../workers/ocr.worker.js'),
  minThreads: 2,        // สร้างอย่างน้อย 2 threads
  maxThreads: 4,        // สร้างมากสุด 4 threads
  idleTimeout: 60000,   // ปิด thread ที่ไม่ได้ใช้ 60 วินาที
  maxQueue: 100,        // คิวสูงสุด 100 tasks
  concurrentTasksPerWorker: 1 // แต่ละ worker ทำงานได้ครั้งละ 1
});

async function processWithWorker(filePath, attachmentId) {
  const result = await ocrPool.run({ filePath, attachmentId });
  return result;
}

/**
 * ประมวลผลหลายไฟล์พร้อมกันด้วย Worker Pool
 * @param {Array} attachments - [{ filePath, attachmentId }]
 * @param {Function} onProgress - Callback สำหรับ progress tracking
 * @returns {Promise} - ผลลัพธ์ทั้งหมด
 */
async function processBatchWithWorkers(attachments, onProgress) {
  const results = [];
  const total = attachments.length;
  let processed = 0;
  let errors = 0;

  // ส่งงานทั้งหมดไปพร้อมกัน (concurrent)
  const promises = attachments.map(async (attachment) => {
    try {
      const result = await processWithWorker(attachment.filePath, attachment.id);
      
      if (result.success) {
        processed++;
      } else {
        errors++;
      }
      
      // ส่ง progress update
      if (onProgress) {
        onProgress({
          processed,
          errors,
          total,
          currentFile: attachment.fileName,
          attachmentId: attachment.id
        });
      }
      
      return result;
      
    } catch (error) {
      errors++;
      
      if (onProgress) {
        onProgress({
          processed,
          errors,
          total,
          currentFile: attachment.fileName,
          attachmentId: attachment.id
        });
      }
      
      return {
        success: false,
        attachmentId: attachment.id,
        error: error.message
      };
    }
  });

  // รอผลลัพธ์ทั้งหมด
  const allResults = await Promise.all(promises);
  
  return {
    processed,
    errors,
    total,
    results: allResults
  };
}

/**
 * ตรวจสอบสถานะของ Thread Pool
 */
function getPoolStatus() {
  return {
    threads: ocrPool.threads.length,
    queueSize: ocrPool.queueSize,
    running: ocrPool.running,
    completed: ocrPool.completed
  };
}

/**
 * ปิด Thread Pool (สำหรับ graceful shutdown)
 */
async function closePool() {
  await ocrPool.close();
}

module.exports = {
  processWithWorker,
  processBatchWithWorkers,
  getPoolStatus,
  closePool
};
