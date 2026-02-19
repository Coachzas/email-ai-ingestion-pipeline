ฝั่ง Backend (ระบบจัดการข้อมูลและ Logic)
1. Multi-Account IMAP Config: ระบบรองรับการเพิ่ม/แก้ไข/ลบ และทดสอบการเชื่อมต่อบัญชีอีเมลได้หลายบัญชี (ยืดหยุ่นกว่าการล็อกค่าเมลเดียว)
2. Intelligent Email Fetching (Preview & Save): มีระบบดึงอีเมลมาให้ดูก่อนบันทึก เพื่อเลือกเฉพาะเมลที่ต้องการ ช่วยลดขยะในฐานข้อมูล
3. IMAP UID Synchronization: ใช้ระบบ UID เพื่อตรวจสอบและป้องกันการดึงอีเมลซ้ำซ้อนเข้าสู่ระบบ
4. Robust Attachment Storage: ระบบแยกเก็บไฟล์แนบลงใน Disk Storage และเก็บ Metadata/Path ไว้ใน Database (รองรับไฟล์ขนาดใหญ่ได้ดี)
5. Relational Database Schema (Prisma): ออกแบบความสัมพันธ์ของข้อมูลแบบ Account ↔ Email ↔ Attachment อย่างสมบูรณ์
6. Real-time Event Streaming (SSE): พัฒนาระบบส่งข้อมูลสถานะการทำงาน (Progress) จาก Server ไปยัง Frontend แบบ Real-time ผ่าน Server-Sent Events

ฝั่ง Frontend (ระบบควบคุมและ Dashboard)
1. Dynamic Account Manager: หน้าจอจัดการบัญชีอีเมลที่สามารถ Test Connection และเลือกบัญชีที่จะใช้งาน (Selected Account) ได้
2. Interactive Email Selection: ระบบ Preview อีเมลที่มาพร้อม Logic การเลือก (Selection) แบบติ๊กถูกก่อนทำการบันทึกจริง
3. Advanced Review Queue: ตารางรายการอีเมลที่มีระบบ Multi-Filter (ค้นหา, กรองตามวันที่, กรองสถานะ OCR, กรองไฟล์แนบ)
4. Live Progress Monitors: หน้าจอ Progress Bar ที่ขยับตามข้อมูลจริงจาก Server ทั้งในส่วนการดึงเมลและการทำ OCR
5. Integrated Data Viewer: หน้า Modal แสดงรายละเอียดอีเมลที่ดึงข้อความ (Extracted Text) จาก OCR มาโชว์ควบคู่กับตัวเมลเดิม
6. Resilient App Design: มีการติดตั้ง ErrorBoundary และ Loading States เพื่อป้องกันแอปค้างและเพิ่มประสบการณ์การใช้งานที่ดี (UX)
