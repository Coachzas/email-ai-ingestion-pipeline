require('dotenv').config();
const app = require('./app');
const { initializeSchedulers } = require('./controllers/batchScheduler.controller');

const PORT = process.env.PORT || 4000;

// Add comprehensive error handling to prevent silent exits
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('❌ Stack:', err.stack);
  // Don't exit the process, keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, keep server running
});

process.on('warning', (warning) => {
  console.warn('⚠️ Warning:', warning.name, warning.message);
  console.warn('⚠️ Stack:', warning.stack);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📋 Global error handlers installed - server will not crash on unhandled rejections');
  
  // Initialize batch schedulers
  try {
    await initializeSchedulers();
    console.log('⏰ Batch schedulers initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize batch schedulers:', error);
  }
});
