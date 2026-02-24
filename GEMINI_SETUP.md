# Gemini AI Studio OCR Integration

## Overview
โครงการนี้ได้ย้ายจากการใช้ Tesseract OCR มาใช้ Google AI Studio (Gemini) สำหรับการดึงข้อความจากรูปภาพและ PDF

## ข้อดีของ Gemini เทียบกับ Tesseract
- ✅ ความแม่นยำสูงกว่ามาก โดยเฉพาะภาษาไทย
- ✅ รองรับไฟล์ PDF โดยตรง (ไม่ต้องแปลงเป็นรูปภาพ)
- ✅ เข้าใจบริบทและโครงสร้างของเอกสารได้ดีกว่า
- ✅ ไม่ต้องติดตั้งซอฟต์แวร์เพิ่มเติม (Tesseract ต้องติดตั้งในระบบ)
- ✅ รองรับภาษาผสมได้ดีกว่า (ไทย + อังกฤษในเอกสารเดียวกัน)

## การตั้งค่า

### 1. ขอ API Key จาก Google AI Studio
1. เข้าไปที่: https://aistudio.google.com/app/apikey
2. ล็อกอินด้วยบัญชี Google
3. คลิก "Create API Key"
4. คัดลอก API key ที่ได้

### 2. ตั้งค่า Environment Variable
สร้างไฟล์ `.env` ในโฟลเดอร์หลัก (ถ้ายังไม่มี) และเพิ่ม:

```bash
# Gemini AI Studio API Key
GEMINI_API_KEY="your-gemini-api-key-here"
```

หรือคัดลอกจาก `.env.example`:

```bash
cp .env.example .env
```

แล้วแก้ไขค่า `GEMINI_API_KEY` ในไฟล์ `.env`

### 3. ติดตั้ง Dependencies
```bash
npm install @google/generative-ai
```

### 4. ทดสอบการเชื่อมต่อ
เริ่ม server:
```bash
npm start
```

ทดสอบ API connection:
```bash
curl -X POST http://localhost:4000/api/gemini/test-connection
```

## การใช้งาน

### API Endpoints

#### ทดสอบการเชื่อมต่อ
```http
POST /api/gemini/test-connection
```

#### ทดสอบ OCR กับไฟล์
```http
POST /api/gemini/test-ocr
Content-Type: application/json

{
  "filePath": "/path/to/your/file.pdf"
}
```

### การใช้ใน Code
```javascript
const { extractTextFromPath } = require('./services/gemini-ocr.service');

// ดึงข้อความจากไฟล์
const text = await extractTextFromPath('/path/to/file.pdf');
console.log(text);
```

## ข้อจำกัดและค่าใช้จ่าย

### ขนาดไฟล์
- **Inline Processing**: สูงสุด 20MB ต่อไฟล์
- **ไฟล์ที่ใหญ่กว่า**: ต้องใช้ Google Cloud Storage (ต้องตั้งค่าเพิ่มเติม)

### ค่าใช้จ่าย
- **Free Tier**: มีโควต้าจำกัดต่อนาที (RPM)
- **Commercial**: เสียค่าใช้จ่ายตามจำนวน Token ที่ใช้
- **ราคา**: ประมาณ $0.00025 ต่อ 1,000 characters (สำหรับ Gemini 1.5 Flash)

### ประสิทธิภาพ
- **ความเร็ว**: เร็วกว่า Tesseract อย่างมีนัยสำคัญ
- **ความแม่นยำ**: สูงกว่ามาก โดยเฉพาะภาษาไทย
- **การใช้งาน**: ไม่ต้องปรับแต่งพารามิเตอร์ซับซ้อน

## ไฟล์ที่รองรับ

### รูปภาพ
- PNG, JPG/JPEG, WebP, BMP, GIF, TIFF

### เอกสาร
- PDF (รองรับหลายหน้าได้)

## การย้อนกลับไปใช้ Tesseract (ถ้าต้องการ)

หากต้องการย้อนกลับไปใช้ Tesseract:

1. แก้ไข `src/workers/ocr.worker.js`:
```javascript
const { extractTextFromPath } = require('../services/attachment-ocr.service');
```

2. ลบไฟล์ที่เกี่ยวข้องกับ Gemini:
- `src/services/extractors/gemini.extractor.js`
- `src/services/gemini-ocr.service.js`
- `src/controllers/gemini.controller.js`
- `src/routes/gemini.routes.js`

3. ลบ Gemini routes จาก `src/app.js`

## การแก้ไขปัญหา

### API Key ไม่ถูกต้อง
```
Error: Failed to extract text with Gemini: Request had invalid authentication credentials
```
แก้ไข: ตรวจสอบว่า GEMINI_API_KEY ถูกต้องใน `.env`

### ไฟล์ใหญ่เกินไป
```
Error: File too large. Maximum size is 20971520 bytes for inline processing.
```
แก้ไข: ใช้ไฟล์ที่เล็กกว่า 20MB หรือตั้งค่า Google Cloud Storage

### ไม่รองรับนามสกุลไฟล์
```
Error: MIME type not supported
```
แก้ไข: ใช้ไฟล์ที่รองรับ (PDF, PNG, JPG, WebP, BMP, GIF, TIFF)

## ข้อมูลเพิ่มเติม
- [Google AI Studio Documentation](https://ai.google.dev/docs)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Supported File Types](https://ai.google.dev/gemini-api/docs/file-types)
