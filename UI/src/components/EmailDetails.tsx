import React from 'react'
import { Email, EmailSummary } from '../types'

interface EmailDetailsProps {
  emails: Email[]
  emailSummary: EmailSummary | null
  onClose: () => void
}

const EmailDetails: React.FC<EmailDetailsProps> = ({ emails, emailSummary, onClose }) => {
  return (
    <div className="email-details-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>📧 รายละเอียดอีเมล ({emails.length})</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {/* สรุปข้อมูล */}
        {emailSummary && (
          <div className="email-summary">
            <h3>📊 สรุปข้อมูลอีเมล</h3>
            <div className="summary-stats">
              <div className="stat-item">
                <strong>📧 อีเมลทั้งหมด:</strong> {emailSummary.totalEmails}
              </div>
              <div className="stat-item">
                <strong>· มีไฟล์แนบ:</strong> {emailSummary.emailsWithFiles}
              </div>
              <div className="stat-item">
                <strong>· ไม่มีไฟล์:</strong> {emailSummary.emailsWithoutFiles}
              </div>
            </div>
            
            {emailSummary.attachments.total > 0 && (
              <div className="attachment-summary">
                <h4>📎 ไฟล์แนบทั้งหมด ({emailSummary.attachments.total} ไฟล์)</h4>
                <div className="attachment-stats">
                  <div className="stat-item">
                    <strong>· OCR แล้ว:</strong> {emailSummary.attachments.ocrStats.processed}
                  </div>
                  <div className="stat-item">
                    <strong>· รอ OCR:</strong> {emailSummary.attachments.ocrStats.pending}
                  </div>
                  {emailSummary.attachments.ocrStats.errors > 0 && (
                    <div className="stat-item error">
                      <strong>❌ มีปัญหา:</strong> {emailSummary.attachments.ocrStats.errors}
                    </div>
                  )}
                </div>
                
                {emailSummary.attachments.problemFiles.length > 0 && (
                  <div className="problem-files">
                    <h5>⚠️ ไฟล์ที่มีปัญหา:</h5>
                    <ul>
                      {emailSummary.attachments.problemFiles.map((file, index) => (
                        <li key={index}>{file.fileName} - {file.issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* รายการอีเมล */}
        <div className="email-list">
          {emails.map((email, index) => (
            <div key={email.id || index} className="email-item">
              <div className="email-header">
                <strong>หัวข้อ:</strong> {email.subject || 'ไม่มีหัวข้อ'}
              </div>
              <div className="email-meta">
                <span><strong>จาก:</strong> {email.fromEmail || email.from || 'ไม่ระบุ'}</span>
                <span><strong>วันที่:</strong> {new Date(email.receivedAt || email.date).toLocaleString('th-TH')}</span>
              </div>
              <div className="email-meta">
                <span><strong>UID:</strong> {email.imapUid}</span>
                <span><strong>ไฟล์แนบ:</strong> {email.attachmentCount || (email.attachments?.length || 0)} ไฟล์</span>
              </div>
              {email.attachments && email.attachments.length > 0 && (
                <div className="attachments">
                  <strong>ไฟล์แนบ:</strong>
                  <ul>
                    {email.attachments.map((attachment, idx) => (
                      <li key={attachment.id || idx}>
                        {attachment.filename || `ไฟล์ที่ ${idx + 1}`} 
                        {attachment.contentType && ` (${attachment.contentType})`}
                        {attachment.size && ` (${(attachment.size / 1024).toFixed(1)} KB)`}
                        {attachment.hasExtractedText && (
                          <span className="extracted-text-indicator"> ✅ มีข้อความ</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmailDetails
