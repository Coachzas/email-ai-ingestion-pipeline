const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// 1. สร้างการเชื่อมต่อผ่าน pg driver โดยตรง
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. ส่ง adapter เข้าไปใน PrismaClient ตามที่ Error แนะนำ
const prisma = new PrismaClient({ adapter });

module.exports = prisma;