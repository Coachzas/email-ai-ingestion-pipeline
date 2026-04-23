const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFilterType() {
  try {
    // อัปเดต scheduler ที่ชื่อ "ดึงอีเมลสมัครงาน" ให้เป็น JOB_ONLY
    const result = await prisma.batchScheduler.updateMany({
      where: {
        name: {
          contains: 'สมัครงาน'
        }
      },
      data: {
        filterType: 'JOB_ONLY'
      }
    });
    
    console.log(`✅ Updated ${result.count} schedulers to JOB_ONLY`);
    
    // ตรวจสอบผลลัพธ์
    const schedulers = await prisma.batchScheduler.findMany({
      select: {
        id: true,
        name: true,
        filterType: true
      }
    });
    
    console.log('🔍 Updated Schedulers:');
    schedulers.forEach(s => {
      console.log(`- ${s.name}: filterType = '${s.filterType}'`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixFilterType();
