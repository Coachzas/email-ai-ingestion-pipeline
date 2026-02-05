import React, { useState } from 'react'

const EmailSelection = ({ 
  emails, 
  onClose, 
  onSaveSelected, 
  isLoading = false 
}) => {
  const [selectedEmails, setSelectedEmails] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const handleToggleEmail = (tempId) => {
    const newSelected = new Set(selectedEmails)
    if (newSelected.has(tempId)) {
      newSelected.delete(tempId)
    } else {
      newSelected.add(tempId)
    }
    setSelectedEmails(newSelected)
    setSelectAll(false)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(emails.map(email => email.tempId)))
    }
    setSelectAll(!selectAll)
  }

  const handleSaveSelected = () => {
    const selectedEmailData = emails.filter(email => selectedEmails.has(email.tempId))
    onSaveSelected(selectedEmailData)
  }

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
      <div className="modal-content email-selection-modal">
        <div className="modal-header">
          <h2>📧 เลือกอีเมลที่ต้องการบันทึก</h2>
          <button onClick={onClose} className="close-btn" aria-label="ปิด">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="selection-info">
            <span>พบอีเมล {emails.length} ฉบับ</span>
            <span>เลือกแล้ว {selectedEmails.size} ฉบับ</span>
          </div>

          <div className="email-selection-controls">
            <button 
              onClick={handleSelectAll}
              className="select-all-btn"
            >
              {selectAll ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
            <button 
              onClick={handleSaveSelected}
              disabled={selectedEmails.size === 0 || isLoading}
              className="save-selected-btn"
            >
              {isLoading ? '⏳ กำลังบันทึก...' : `บันทึกที่เลือก (${selectedEmails.size})`}
            </button>
          </div>

          <div className="email-list">
            {emails.map((email) => (
              <div 
                key={email.tempId}
                className={`email-item selectable ${selectedEmails.has(email.tempId) ? 'selected' : ''}`}
                onClick={() => handleToggleEmail(email.tempId)}
              >
                <div className="email-item-header">
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(email.tempId)}
                    onChange={() => handleToggleEmail(email.tempId)}
                    className="email-checkbox"
                  />
                  <div className="email-content">
                    <div className="email-header">{email.subject}</div>
                    <div className="email-meta">
                      <span>
                        <strong>จาก:</strong> {email.fromEmail}
                      </span>
                      <span>
                        <strong>วันที่:</strong> {formatDate(email.receivedAt)}
                      </span>
                    </div>
                    {email.attachmentCount > 0 && (
                      <div className="attachments">
                        <strong>ไฟล์แนบ:</strong>
                        <ul>
                          {email.attachments.map((att, index) => (
                            <li key={index}>
                              {att.filename} ({att.contentType})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="selection-info">
                      UID: {email.imapUid} | ไฟล์แนบ: {email.attachmentCount}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailSelection
