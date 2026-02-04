const prisma = require('./src/utils/prisma');

(async () => {
  try {
    const emails = await prisma.email.count();
    const attachments = await prisma.attachment.count();
    const withoutText = await prisma.attachment.count({ where: { extractedText: null } });
    const withEmptyText = await prisma.attachment.count({ where: { extractedText: '' } });
    
    console.log('📊 Database Stats:');
    console.log('  Total Emails:', emails);
    console.log('  Total Attachments:', attachments);
    console.log('  Attachments with NULL extractedText:', withoutText);
    console.log('  Attachments with EMPTY extractedText:', withEmptyText);
    
    if (attachments > 0) {
      const sample = await prisma.attachment.findFirst();
      console.log('\n📋 Sample Attachment:');
      console.log('  fileName:', sample.fileName);
      console.log('  fileType:', sample.fileType);
      console.log('  extractedText:', sample.extractedText);
      console.log('  filePath:', sample.filePath);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
