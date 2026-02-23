// Store active SSE connections for email progress
const activeConnections = new Set();

// Global email progress state
let emailProgress = {
  isProcessing: false,
  currentEmail: '',
  totalEmails: 0,
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
      activeConnections.delete(client);
    }
  });
}

// Update email progress and broadcast to clients
function updateEmailProgress(updates) {
  emailProgress = { ...emailProgress, ...updates };
  broadcastProgress(emailProgress);
}

// SSE endpoint for email progress
async function getEmailProgress(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send current progress immediately
  res.write(`data: ${JSON.stringify(emailProgress)}\n\n`);

  // Add connection to active connections
  activeConnections.add(res);

  // Handle client disconnect
  // Send heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    activeConnections.delete(res);
  });
}

// Start email processing with progress tracking
async function startEmailProgress(totalEmails) {
  if (emailProgress.isProcessing) {
    throw new Error('Email saving is already processing');
  }

  emailProgress.isProcessing = true;
  emailProgress.currentEmail = 'กำลังเริ่มต้น...';
  emailProgress.totalEmails = totalEmails;
  emailProgress.processed = 0;
  emailProgress.errors = 0;
  emailProgress.startTime = Date.now();
  broadcastProgress(emailProgress);

  return emailProgress;
}

// Complete email processing
function completeEmailProgress() {
  emailProgress.isProcessing = false;
  emailProgress.currentEmail = 'เสร็จสิ้น';
  broadcastProgress(emailProgress);
}

// Update current email being processed
function updateCurrentEmail(emailSubject) {
  emailProgress.currentEmail = emailSubject;
  broadcastProgress(emailProgress);
}

// Increment processed count
function incrementProcessed() {
  emailProgress.processed++;
  broadcastProgress(emailProgress);
}

// Increment error count
function incrementErrors() {
  emailProgress.errors++;
  broadcastProgress(emailProgress);
}

module.exports = {
  getEmailProgress,
  startEmailProgress,
  completeEmailProgress,
  updateCurrentEmail,
  incrementProcessed,
  incrementErrors,
  updateEmailProgress
};
