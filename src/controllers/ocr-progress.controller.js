const { processBatchWithWorkers } = require('../utils/thread-pool');

// Store active SSE connections
const activeConnections = new Set();

// Global OCR progress state
let ocrProgress = {
  isProcessing: false,
  currentFile: '',
  totalFiles: 0,
  processed: 0,
  errors: 0,
  startTime: null
};

function broadcastProgress(progress) {
  const data = `data: ${JSON.stringify(progress)}\n\n`;
  
  activeConnections.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      activeConnections.delete(client);
    }
  });
}

async function processAttachmentsWithProgress(limit) {
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    originalLog(...args);
    const message = args.join(' ');
    
    if (message.includes('🔍 Extracting text from:') || 
        message.includes('📷 Processing image file:') || 
        message.includes('📄 Processing PDF file:') ||
        message.includes('📊 Processing CSV file:') ||
        message.includes('📝 Processing document file:')) {
      const match = message.match(/Processing (.+?) \((.+?)\)|Extracting text from: (.+?) \((.+?)\)/);
      if (match) {
        const fileName = match[1] || match[3];
        ocrProgress.currentFile = fileName;
        broadcastProgress(ocrProgress);
      }
    }
    
    if (message.includes('✅ Summary: Processed') || 
        message.includes('✅ Summary:')) {
      const match = message.match(/Processed (\d+)\/(\d+)/);
      if (match) {
        ocrProgress.processed = parseInt(match[1]);
        broadcastProgress(ocrProgress);
      }
    }
    
    if (message.includes('❌') && !message.includes('File not found')) {
      ocrProgress.errors++;
      broadcastProgress(ocrProgress);
    }
  };
  
  console.error = (...args) => {
    originalError(...args);
    const message = args.join(' ');
    if (message.includes('❌') && !message.includes('File not found')) {
      ocrProgress.errors++;
      broadcastProgress(ocrProgress);
    }
  };
  
  try {
    const prisma = require('../utils/prisma');

    // ดึง attachment ที่ไม่ได้ประมวลผล (ใช้ ocrStatus เหมือนระบบหลัก)
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [
          { ocrStatus: null },
          { ocrStatus: { not: 'COMPLETED' } }
        ]
      },
      take: typeof limit === 'number' ? limit : undefined,
    });

    ocrProgress.totalFiles = attachments.length;
    ocrProgress.processed = 0;
    ocrProgress.errors = 0;
    ocrProgress.startTime = Date.now();
    ocrProgress.currentFile = attachments.length > 0 ? 'กำลังเริ่มต้น...' : 'ไม่มีไฟล์ที่ต้องประมวลผล';
    broadcastProgress(ocrProgress);

    if (attachments.length === 0) {
      ocrProgress.isProcessing = false;
      ocrProgress.currentFile = '✅ ไม่มีไฟล์ที่ต้องประมวลผล';
      broadcastProgress(ocrProgress);
      return { processed: 0, errors: 0, skipped: 0, results: [] };
    }

    const attachmentsForWorkers = attachments.map(att => ({
      filePath: att.filePath,
      id: att.id,
      fileName: att.fileName
    }));
    
    const result = await processBatchWithWorkers(
      attachmentsForWorkers,
      (progress) => {
        ocrProgress.processed = progress.processed;
        ocrProgress.errors = progress.errors;
        ocrProgress.currentFile = progress.currentFile;
        broadcastProgress(ocrProgress);
      }
    );
    
    ocrProgress.isProcessing = false;
    ocrProgress.currentFile = '✅ เสร็จสิ้น';
    ocrProgress.completed = true;
    broadcastProgress(ocrProgress);
    
    // ส่ง event ให้ refresh หน้า Email Review Center
    setTimeout(() => {
      broadcastProgress({
        ...ocrProgress,
        refresh: true,
        message: '🔄 กรุณารีเฟรชหน้าเพื่อดูผลลัพธ์ล่าสุด'
      });
    }, 1000);
    
    return result;
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function getOcrProgress(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  res.write(`data: ${JSON.stringify(ocrProgress)}\n\n`);
  activeConnections.add(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    activeConnections.delete(res);
  });
}

async function startOcrWithProgress(req, res) {
  try {
    const { limit = 30 } = req.body || {};
    
    // 1. ตรวจสอบว่า OCR กำลังประมวลผลอยู่หรือไม่
    if (ocrProgress.isProcessing) {
      return res.status(400).json({
        success: false,
        message: 'OCR is already processing'
      });
    }

    // 2. ตั้งค่า OCR progress
    ocrProgress.isProcessing = true;
    ocrProgress.currentFile = 'กำลังเริ่มต้น...';
    broadcastProgress(ocrProgress);

    res.json({
      success: true,
      message: 'OCR processing started',
      isProcessing: true
    });

    // 3. เริ่ม OCR ใน background
    processAttachmentsWithProgress(limit)
      .then(result => {
        ocrProgress.isProcessing = false;
        broadcastProgress(ocrProgress);
      })
      .catch(err => {
        ocrProgress.isProcessing = false;
        broadcastProgress(ocrProgress);
      });

  } catch (error) {
    ocrProgress.isProcessing = false;
    res.status(500).json({
      success: false,
      message: 'Failed to start OCR processing',
      error: error.message
    });
  }
}

module.exports = {
  getOcrProgress,
  startOcrWithProgress
};
