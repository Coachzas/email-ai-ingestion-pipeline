import React, { useState } from 'react'

interface Email {
  tempId: string
  imapUid: number
  fromEmail: string
  subject: string
  receivedAt: string
  attachmentCount: number
  attachments: any[]
}

interface EmailSelectionProps {
  emails: Email[]
  onClose: () => void
  onSaveSelected: (selectedEmails: Email[]) => void
  isLoading?: boolean
}

const EmailSelection: React.FC<EmailSelectionProps> = ({ 
  emails, 
  onClose, 
  onSaveSelected, 
  isLoading = false 
}) => {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const handleToggleEmail = (tempId: string) => {
    const newSelected = new Set(selectedEmails)
    if (newSelected.has(tempId)) {
      newSelected.delete(tempId)
    } else {
      newSelected.add(tempId)
    }
    setSelectedEmails(newSelected)
    setSelectAll(newSelected.size === emails.length)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmails(new Set())
      setSelectAll(false)
    } else {
      setSelectedEmails(new Set(emails.map(email => email.tempId)))
      setSelectAll(true)
    }
  }

  const handleSaveSelected = () => {
    const selected = emails.filter(email => selectedEmails.has(email.tempId))
    onSaveSelected(selected)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="email-details-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>📋 เลือกอีเมลที่จะบันทึก ({emails.length})</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {/* Email Selection Controls */}
        <div className="email-selection-controls">
          <button 
            onClick={handleSelectAll}
            className="select-all-btn secondary-button"
            type="button"
          >
            {selectAll ? '⬜ ยกเลิกเลือกทั้งหมด' : '☑️ เลือกทั้งหมด'}
          </button>
          
          <button 
            onClick={handleSaveSelected}
            className="save-selected-btn"
            disabled={selectedEmails.size === 0 || isLoading}
            type="button"
          >
            {isLoading ? '⏳ กำลังบันทึก...' : `💾 บันทึก ${selectedEmails.size} ฉบับ`}
          </button>

          <div className="selection-info">
            เลือกแล้ว {selectedEmails.size} จาก {emails.length} ฉบับ
          </div>
        </div>

        {/* Email List */}
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
                  className="email-checkbox"
                  checked={selectedEmails.has(email.tempId)}
                  onChange={() => handleToggleEmail(email.tempId)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="email-content">
                  <div className="email-header">
                    <strong>หัวข้อ:</strong> {email.subject || 'ไม่มีหัวข้อ'}
                  </div>
                  <div className="email-meta">
                    <span><strong>จาก:</strong> {email.fromEmail || 'ไม่ระบุ'}</span>
                    <span><strong>วันที่:</strong> {formatDate(email.receivedAt)}</span>
                    <span><strong>ไฟล์แนบ:</strong> {email.attachmentCount}</span>
                  </div>
                  {email.attachmentCount > 0 && (
                    <div className="attachments">
                      <strong>ไฟล์แนบ:</strong>
                      <ul>
                        {email.attachments.slice(0, 3).map((att, index) => (
                          <li key={index}>
                            {att.filename || att.fileName} ({att.contentType || att.fileType})
                          </li>
                        ))}
                        {email.attachments.length > 3 && (
                          <li>...และอีก {email.attachments.length - 3} ไฟล์</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmailSelection
