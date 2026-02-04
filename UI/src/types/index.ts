export interface EmailData {
  emailCount: number
  emails?: Email[]
  ocr?: OCRStatus
}

export interface Email {
  id: string
  subject: string
  from: string
  to: string[]
  date: string
  body: string
  imapUid: number
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  filename: string
  contentType: string
  size: number
  path: string
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
