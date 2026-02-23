const { processAttachmentsOCR } = require('../services/attachment-ocr.service');
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

// Broadcast progress to all connected clients
function broadcastProgress(progress) {
  const data = `data: ${JSON.stringify(progress)}\n\n`;
  
  activeConnections.forEach(client => {
    try {
      client.write(data);
    } catch (err) {
      console.error('❌ Failed to send progress to client:', err);
      activeConnections.delete(client);
    }
  });
}

// Enhanced OCR service with progress callbacks
async function processAttachmentsWithProgress(limit = 30) {
  // Use the imported service from top of file
  
  // Override the OCR service to emit progress
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args) => {
    originalLog(...args);
    
    // Parse progress from log messages
    const message = args.join(' ');
    
    // Update current file from log
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
    
    // Update processed count from summary (more reliable)
    if (message.includes('✅ Summary: Processed') || 
        message.includes('✅ Summary:')) {
      const match = message.match(/Processed (\d+)\/(\d+)/);
      if (match) {
        ocrProgress.processed = parseInt(match[1]);
        broadcastProgress(ocrProgress);
      }
    }
    
    // Update error count
    if (message.includes('❌') && !message.includes('File not found')) {
      ocrProgress.errors++;
      broadcastProgress(ocrProgress);
    }
    
    // Remove duplicate processed count update - use summary only
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
    // Get attachments to process
    const prisma = require('../utils/prisma');
    const attachments = await prisma.attachment.findMany({
      where: {
        OR: [
          { extractedText: null },
          { extractedText: '' }
        ]
      },
      take: typeof limit === 'number' ? limit : undefined,
    });

    // Set initial progress state BEFORE processing
    ocrProgress.totalFiles = attachments.length;
    ocrProgress.processed = 0;
    ocrProgress.errors = 0;
    ocrProgress.startTime = Date.now();
    ocrProgress.currentFile = attachments.length > 0 ? 'กำลังเริ่มต้น...' : 'ไม่มีไฟล์ที่ต้องประมวลผล';
    broadcastProgress(ocrProgress);

    // If no files to process, mark as completed immediately
    if (attachments.length === 0) {
      ocrProgress.isProcessing = false;
      ocrProgress.currentFile = '✅ ไม่มีไฟล์ที่ต้องประมวลผล';
      broadcastProgress(ocrProgress);
      return { processed: 0, errors: 0, skipped: 0, results: [] };
    }

    // Process attachments with Worker Pool (Non-blocking)
    console.log(`🎮 Found ${attachments.length} attachments to process`);
    const attachmentsForWorkers = attachments.map(att => ({
      filePath: att.filePath,
      id: att.id,
      fileName: att.fileName
    }));
    
    console.log(`🎮 Using Worker Pool to process ${attachmentsForWorkers.length} files`);
    const result = await processBatchWithWorkers(
      attachmentsForWorkers,
      (progress) => {
        // Update progress from Worker Pool
        ocrProgress.processed = progress.processed;
        ocrProgress.errors = progress.errors;
        ocrProgress.currentFile = progress.currentFile;
        broadcastProgress(ocrProgress);
      }
    );
    
    console.log(`🎮 Worker Pool completed:`, result);
    
    // Final progress update - MARK AS COMPLETED
    ocrProgress.isProcessing = false;
    ocrProgress.currentFile = '✅ เสร็จสิ้น';
    broadcastProgress(ocrProgress);
    
    return result;
  } finally {
    // Restore original console methods
    console.log = originalLog;
    console.error = originalError;
  }
}

// SSE endpoint for OCR progress
async function getOcrProgress(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send current progress immediately
  res.write(`data: ${JSON.stringify(ocrProgress)}\n\n`);

  // Add connection to active connections
  activeConnections.add(res);

  // Handle client disconnect
  req.on('close', () => {
    activeConnections.delete(res);
  });

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    if (activeConnections.has(res)) {
      res.write(': heartbeat\n\n');
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
}

// Start OCR processing with progress tracking
async function startOcrWithProgress(req, res, limit = 30) {
  try {
    if (ocrProgress.isProcessing) {
      return res.status(400).json({
        success: false,
        message: 'OCR is already processing'
      });
    }

    // Set initial state and respond immediately (Non-blocking)
    ocrProgress.isProcessing = true;
    ocrProgress.currentFile = 'กำลังเริ่มต้น...';
    broadcastProgress(ocrProgress);

    // Respond to client immediately
    res.json({
      success: true,
      message: 'OCR processing started',
      isProcessing: true
    });

    // Start processing in background (non-blocking)
    processAttachmentsWithProgress(limit)
      .then(result => {
        console.log('✅ OCR processing completed:', result);
        ocrProgress.isProcessing = false;
        broadcastProgress(ocrProgress);
      })
      .catch(err => {
        console.error('❌ OCR processing failed:', err);
        ocrProgress.isProcessing = false;
        ocrProgress.currentFile = '❌ เกิดข้อผิดพลาด';
        broadcastProgress(ocrProgress);
      });

  } catch (err) {
    console.error('❌ Failed to start OCR:', err);
    ocrProgress.isProcessing = false;
    res.status(500).json({
      success: false,
      message: 'Failed to start OCR processing',
      error: err.message
    });
  }
}

module.exports = {
  getOcrProgress,
  startOcrWithProgress
};
