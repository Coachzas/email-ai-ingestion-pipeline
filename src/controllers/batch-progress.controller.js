// Store active SSE connections for batch progress
const activeConnections = new Set();

// Global batch progress state (combines email saving + OCR)
let batchProgress = {
  isProcessing: false,
  currentPhase: '', // 'fetching', 'saving', 'ocr', 'completed'
  currentItem: '',
  totalEmails: 0,
  processedEmails: 0,
  skippedEmails: 0,
  totalAttachments: 0,
  processedAttachments: 0,
  errors: 0,
  startTime: null,
  phaseDetails: {
    fetching: { current: '', total: 0 },
    saving: { current: '', total: 0 },
    ocr: { current: '', total: 0 }
  }
};

// Broadcast progress to all connected clients
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

// Update batch progress and broadcast to clients
function updateBatchProgress(updates) {
  batchProgress = { ...batchProgress, ...updates };
  broadcastProgress(batchProgress);
}

// Update phase-specific progress
function updatePhaseProgress(phase, current, total = null) {
  batchProgress.currentPhase = phase;
  batchProgress.phaseDetails[phase] = {
    current,
    total: total !== null ? total : batchProgress.phaseDetails[phase].total
  };
  batchProgress.currentItem = current;
  broadcastProgress(batchProgress);
}

// SSE endpoint for batch progress
async function getBatchProgress(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send current progress immediately
  res.write(`data: ${JSON.stringify(batchProgress)}\n\n`);

  // Add connection to active connections
  activeConnections.add(res);

  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    activeConnections.delete(res);
  });
}

// Start batch processing with progress tracking
async function startBatchProgress(totalEmails) {
  if (batchProgress.isProcessing) {
    throw new Error('Batch processing is already running');
  }

  batchProgress.isProcessing = true;
  batchProgress.currentPhase = 'fetching';
  batchProgress.currentItem = 'กำลังเริ่มต้น...';
  batchProgress.totalEmails = totalEmails;
  batchProgress.processedEmails = 0;
  batchProgress.skippedEmails = 0;
  batchProgress.totalAttachments = 0;
  batchProgress.processedAttachments = 0;
  batchProgress.errors = 0;
  batchProgress.startTime = Date.now();
  batchProgress.phaseDetails = {
    fetching: { current: 'กำลังเชื่อมต่อ...', total: totalEmails },
    saving: { current: '', total: 0 },
    ocr: { current: '', total: 0 }
  };
  broadcastProgress(batchProgress);

  return batchProgress;
}

// Complete batch processing
function completeBatchProgress() {
  batchProgress.isProcessing = false;
  batchProgress.currentPhase = 'completed';
  batchProgress.currentItem = '✅ เสร็จสิ้น';
  broadcastProgress(batchProgress);
}

// Update fetching phase progress
function updateFetchingProgress(currentEmail, total = null, processed = null) {
  batchProgress.currentPhase = 'fetching';
  
  // อัปเดต phase details
  if (total !== null) {
    batchProgress.phaseDetails.fetching.total = total;
  }
  
  // ถ้า processed เป็นตัวเลข ให้ใช้เป็น current progress
  if (typeof processed === 'number') {
    batchProgress.phaseDetails.fetching.current = processed;
  } else {
    batchProgress.phaseDetails.fetching.current = currentEmail;
  }
  
  batchProgress.currentItem = currentEmail;
  broadcastProgress(batchProgress);
}

// Update saving phase progress
function updateSavingProgress(currentEmail, saved = 0, total = null) {
  batchProgress.currentPhase = 'saving';
  batchProgress.processedEmails = saved;
  batchProgress.phaseDetails.saving = {
    current: currentEmail,
    total: total !== null ? total : batchProgress.phaseDetails.saving.total
  };
  batchProgress.currentItem = currentEmail;
  broadcastProgress(batchProgress);
}

// Update OCR phase progress
function updateOcrProgress(currentFile, processed = 0, total = null) {
  batchProgress.currentPhase = 'ocr';
  batchProgress.processedAttachments = processed;
  batchProgress.phaseDetails.ocr = {
    current: currentFile,
    total: total !== null ? total : batchProgress.phaseDetails.ocr.total
  };
  batchProgress.currentItem = currentFile;
  broadcastProgress(batchProgress);
}

// Increment error count
function incrementErrors() {
  batchProgress.errors++;
  broadcastProgress(batchProgress);
}

// Reset progress
function resetProgress() {
  batchProgress = {
    isProcessing: false,
    currentPhase: '',
    currentItem: '',
    totalEmails: 0,
    processedEmails: 0,
    skippedEmails: 0,
    totalAttachments: 0,
    processedAttachments: 0,
    errors: 0,
    startTime: null,
    phaseDetails: {
      fetching: { current: '', total: 0 },
      saving: { current: '', total: 0 },
      ocr: { current: '', total: 0 }
    }
  };
  broadcastProgress(batchProgress);
}

// Create progress logger for batch operations
function createBatchLogger() {
  const originalLog = console.log;
  const originalError = console.error;
  
  return {
    log: (...args) => {
      originalLog(...args);
      const message = args.join(' ');
      
      // Fetching phase
      if (message.includes('📧 Connecting to IMAP') || 
          message.includes('📧 IMAP fetch') ||
          message.includes('[IMAP]')) {
        updateFetchingProgress(message);
      }
      
      // Saving phase
      if (message.includes('📧 Batch result') || 
          message.includes('saved') ||
          message.includes('Emails will appear')) {
        const match = message.match(/saved (\d+) new emails/);
        if (match) {
          updateSavingProgress('บันทึกอีเมล', parseInt(match[1]));
        }
      }
      
      // OCR phase
      if (message.includes('🔍 Starting automatic OCR') ||
          message.includes('✅ OCR/Extract completed') ||
          message.includes('Found') && message.includes('attachments to process') ||
          message.includes('OCR completed for') ||
          message.includes('OCR failed for') ||
          message.includes('File not found') ||
          message.includes('OCR skipped for')) {
        if (message.includes('Starting automatic OCR')) {
          updateOcrProgress('กำลังเริ่ม OCR...');
        } else if (message.includes('Found') && message.includes('attachments to process')) {
          const match = message.match(/Found (\d+) attachments to process/);
          if (match) {
            updateOcrProgress('พบไฟล์ที่ต้องทำ OCR', 0, parseInt(match[1]));
          }
        } else if (message.includes('OCR completed for')) {
          const match = message.match(/OCR completed for (.+) \(Email:/);
          if (match) {
            const fileName = match[1];
            updateOcrProgress(fileName);
          }
        } else if (message.includes('OCR failed for')) {
          const match = message.match(/OCR failed for (.+):/);
          if (match) {
            const fileName = match[1];
            updateOcrProgress(fileName);
          }
        } else if (message.includes('File not found')) {
          const match = message.match(/File not found: (.+) -/);
          if (match) {
            const fileName = match[1].split('\\').pop(); // Get just filename
            updateOcrProgress(`❌ ${fileName} (ไม่พบไฟล์)`);
          }
        } else if (message.includes('OCR skipped for')) {
          const match = message.match(/OCR skipped for (.+) -/);
          if (match) {
            const fileName = match[1];
            updateOcrProgress(`📄 ${fileName} (ข้าม - ไม่รองรับ)`);
          }
        } else if (message.includes('completed')) {
          const match = message.match(/Processed (\d+) attachments, (\d+) errors/);
          if (match) {
            updateOcrProgress('OCR เสร็จสิ้น', parseInt(match[1]));
          }
        }
      }
      
      // Error handling
      if (message.includes('❌') && !message.includes('File not found')) {
        incrementErrors();
      }
    },
    
    error: (...args) => {
      originalError(...args);
      const message = args.join(' ');
      if (message.includes('❌') && !message.includes('File not found')) {
        incrementErrors();
      }
    },
    
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    }
  };
}

module.exports = {
  getBatchProgress,
  startBatchProgress,
  completeBatchProgress,
  updateFetchingProgress,
  updateSavingProgress,
  updateOcrProgress,
  incrementErrors,
  updateBatchProgress,
  resetProgress,
  createBatchLogger
};
