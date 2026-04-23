const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchedulers() {
  try {
    const schedulers = await prisma.batchScheduler.findMany({
      select: {
        id: true,
        name: true,
        filterType: true,
        createdAt: true
      }
    });
    
    console.log('🔍 All Schedulers:');
    schedulers.forEach(s => {
      console.log(`- ${s.name} (${s.id}): filterType = '${s.filterType}'`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSchedulers();
