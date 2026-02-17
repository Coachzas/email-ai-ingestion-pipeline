const { PrismaClient } = require('@prisma/client');

// สร้าง instance โดยไม่ต้องใส่ options เข้าไป
const prisma = new PrismaClient();

module.exports = prisma;