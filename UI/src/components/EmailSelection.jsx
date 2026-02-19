import React, { useState } from 'react'

const EmailSelection = ({ 
  emails, 
  onClose, 
  onSaveSelected, 
  isLoading = false,
  emailLimit = 50 
}) => {
  const [selectedEmails, setSelectedEmails] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const displayEmails = emailLimit === 'all' ? emails : emails.slice(0, emailLimit);
  const displayLimitText = emailLimit === 'all' ? 'ทั้งหมด' : emailLimit;
  const displayCount = emailLimit === 'all' ? emails.length : Math.min(emails.length, emailLimit);

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
    if (!dateString) return 'ไม่ระบุวันที่';
    
    try {
      return new Date(dateString).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Invalid date:', dateString, error);
      return 'วันที่ไม่ถูกต้อง';
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content email-selection-modal">
        <div className="email-selection-header">
          <h3>เลือกอีเมลที่ต้องการบันทึก</h3>
          <p>แสดง {displayCount} จาก {emails.length} อีเมล (จำกัด: {displayLimitText})</p>
        </div>
        <div className="modal-header">
          <button 
            onClick={onClose} 
            className="close-btn" 
            aria-label="ปิด"
            disabled={isLoading}
          >
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
              disabled={isLoading}
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
            {displayEmails.map((email) => (
              <div 
                key={email.tempId}
                className={`email-item selectable ${selectedEmails.has(email.tempId) ? 'selected' : ''} ${isLoading ? 'disabled' : ''}`}
                onClick={() => !isLoading && handleToggleEmail(email.tempId)}
              >
                <div className="email-item-header">
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(email.tempId)}
                    onChange={() => !isLoading && handleToggleEmail(email.tempId)}
                    className="email-checkbox"
                    disabled={isLoading}
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
