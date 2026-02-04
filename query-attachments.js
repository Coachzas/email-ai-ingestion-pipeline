#!/usr/bin/env node

// Query attachments from DB without connection issues
const { exec } = require('child_process');

// Use psql to query directly (adjust this if you prefer another tool)
const dbURL = process.env.DATABASE_URL || 'postgresql://Coach:1576715767@localhost:5432/ai_IMAP_db';

// Simple query using psql
const cmd = `psql "${dbURL}" -c "SELECT id, fileName, fileType, extractedText IS NOT NULL as has_text FROM \"Attachment\" LIMIT 10;"`;

console.log('📋 Querying attachments from database...\n');
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error('❌ Query failed:', stderr || err.message);
    process.exit(1);
  }
  console.log(stdout);
  process.exit(0);
});
