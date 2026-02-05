import React from 'react'

const EmailDetails = ({ emails, onClose }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>📧 รายละเอียดอีเมลที่ดึงมา</h3>
          <button onClick={onClose} className="close-btn" aria-label="ปิด">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="email-list">
            {emails.map((email, index) => (
              <div key={index} className="email-item">
                <div className="email-header">{email.subject}</div>
                <div className="email-meta">
                  <span>
                    <strong>จาก:</strong> {email.from}
                  </span>
                  <span>
                    <strong>วันที่:</strong> {formatDate(email.date)}
                  </span>
                  <span>
                    <strong>UID:</strong> {email.imapUid}
                  </span>
                </div>
                {email.text && (
                  <div className="email-body">
                    <strong>เนื้อหา:</strong>
                    <p>{email.text.substring(0, 200)}...</p>
                  </div>
                )}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="attachments">
                    <strong>ไฟล์แนบ:</strong>
                    <ul>
                      {email.attachments.map((att, attIndex) => (
                        <li key={attIndex}>
                          {att.filename} ({att.contentType}, {att.size} bytes)
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
    </div>
  )
}

export default EmailDetails
