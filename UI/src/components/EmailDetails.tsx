import React from 'react'
import { Email } from '../types'

interface EmailDetailsProps {
  emails: Email[]
  onClose: () => void
}

const EmailDetails: React.FC<EmailDetailsProps> = ({ emails, onClose }) => {
  return (
    <div className="email-details-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>📧 รายละเอียดอีเมล ({emails.length})</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="email-list">
          {emails.map((email, index) => (
            <div key={email.id || index} className="email-item">
              <div className="email-header">
                <strong>หัวข้อ:</strong> {email.subject}
              </div>
              <div className="email-meta">
                <span><strong>จาก:</strong> {email.from}</span>
                <span><strong>วันที่:</strong> {new Date(email.date).toLocaleString('th-TH')}</span>
              </div>
              {email.attachments && email.attachments.length > 0 && (
                <div className="attachments">
                  <strong>ไฟล์แนบ:</strong>
                  <ul>
                    {email.attachments.map((attachment, idx) => (
                      <li key={attachment.id || idx}>
                        {attachment.filename} ({(attachment.size / 1024).toFixed(1)} KB)
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
