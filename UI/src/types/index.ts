export interface EmailData {
  emailCount: number
  emails?: Email[]
  ocr?: OCRStatus
}

export interface Email {
  id: string
  subject: string
  from: string
  fromEmail?: string  // เพิ่ม fallback สำหรับ fromEmail
  to: string[]
  date: string
  receivedAt?: string  // เพิ่ม fallback สำหรับ receivedAt
  body: string
  imapUid: number
  attachments?: Attachment[]
  attachmentCount?: number  // เพิ่ม fallback สำหรับ attachmentCount
}

export interface Attachment {
  id: string
  filename?: string  // ทำให้เป็น optional
  contentType?: string  // ทำให้เป็น optional
  size?: number  // ทำให้เป็น optional
  path?: string  // ทำให้เป็น optional
  hasExtractedText?: boolean  // เพิ่มฟิลด์นี้
}

export interface OCRStatus {
  total: number
  processed: number
  successful: number
  errors: number
  results?: OCRResult[]
}

export interface OCRResult {
  attachmentId: string
  filename: string
  text?: string
  error?: string
  confidence?: number
}

export interface FetchEmailsRequest {
  startDate?: string | null
  endDate?: string | null
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AppError {
  message: string
  code?: string
  details?: any
}

export interface EmailSummary {
  totalEmails: number
  emailsWithFiles: number
  emailsWithoutFiles: number
  attachments: {
    total: number
    ocrStats: {
      total: number
      processed: number
      pending: number
      errors: number
    }
    fileTypeStats: Record<string, number>
    problemFiles: Array<{
      fileName: string
      issue: string
    }>
  }
}
