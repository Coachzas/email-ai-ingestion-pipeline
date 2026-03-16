#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrateToSupabase() {
  console.log('🚀 Starting migration to Supabase...');
  
  try {
    // 1. Create User model
    console.log('📝 Creating User model...');
    
    // Check if User table exists
    const userTableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'User'
      );
    `;
    
    if (!userTableExists[0].exists) {
      console.log('⚠️  User table not found. Please run: npx prisma migrate dev --name add_user_model');
      return;
    }
    
    // 2. Add userId columns to existing tables
    console.log('🔄 Adding userId columns...');
    
    // Add userId to Email table
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Email" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT,
        ADD COLUMN IF NOT EXISTS "user_email_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('✅ Added userId to Email table');
    } catch (error) {
      console.log('ℹ️  Email userId column may already exist');
    }
    
    // Add userId to EmailAccount table
    try {
      await prisma.$executeRaw`
        ALTER TABLE "EmailAccount" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT,
        ADD COLUMN IF NOT EXISTS "user_emailaccount_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('✅ Added userId to EmailAccount table');
    } catch (error) {
      console.log('ℹ️  EmailAccount userId column may already exist');
    }
    
    // Add userId to BatchScheduler table
    try {
      await prisma.$executeRaw`
        ALTER TABLE "BatchScheduler" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT,
        ADD COLUMN IF NOT EXISTS "accountId" TEXT,
        ADD COLUMN IF NOT EXISTS "account_batchscheduler_id_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        ADD COLUMN IF NOT EXISTS "user_batchscheduler_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('✅ Added userId to BatchScheduler table');
    } catch (error) {
      console.log('ℹ️  BatchScheduler userId column may already exist');
    }
    
    // Add userId to Attachment table
    try {
      await prisma.$executeRaw`
        ALTER TABLE "Attachment" 
        ADD COLUMN IF NOT EXISTS "userId" TEXT,
        ADD COLUMN IF NOT EXISTS "cloudPath" TEXT,
        ADD COLUMN IF NOT EXISTS "cloudProvider" TEXT,
        ADD COLUMN IF NOT EXISTS "user_attachment_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `;
      console.log('✅ Added userId to Attachment table');
    } catch (error) {
      console.log('ℹ️  Attachment userId column may already exist');
    }
    
    // 3. Create default admin user
    console.log('👤 Creating default admin user...');
    
    // Check if admin user exists
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@example.com' }
    });
    
    if (!existingAdmin) {
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          name: 'System Administrator',
          id: '00000000-0000-0000-0000-000000000001' // Fixed UUID for admin
        }
      });
      console.log(`✅ Created admin user: ${adminUser.email}`);
    } else {
      console.log('ℹ️  Admin user already exists');
    }
    
    // 4. Migrate existing data to admin user
    console.log('🔄 Migrating existing data to admin user...');
    
    const adminUserId = '00000000-0000-0000-0000-000000000001';
    
    // Update emails without userId
    const updatedEmails = await prisma.email.updateMany({
      where: { userId: null },
      data: { userId: adminUserId }
    });
    console.log(`✅ Updated ${updatedEmails.count} emails`);
    
    // Update email accounts without userId
    const updatedAccounts = await prisma.emailAccount.updateMany({
      where: { userId: null },
      data: { userId: adminUserId }
    });
    console.log(`✅ Updated ${updatedAccounts.count} email accounts`);
    
    // Update batch schedulers without userId
    const updatedSchedulers = await prisma.batchScheduler.updateMany({
      where: { userId: null },
      data: { userId: adminUserId }
    });
    console.log(`✅ Updated ${updatedSchedulers.count} batch schedulers`);
    
    // Update attachments without userId
    const updatedAttachments = await prisma.attachment.updateMany({
      where: { userId: null },
      data: { userId: adminUserId }
    });
    console.log(`✅ Updated ${updatedAttachments.count} attachments`);
    
    console.log('🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your .env file with Supabase credentials');
    console.log('2. Run: npx prisma generate');
    console.log('3. Restart your application');
    console.log('4. Test the authentication system');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToSupabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateToSupabase };
