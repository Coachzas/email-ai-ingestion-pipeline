import React from 'react'

export default function EmailProgressIndicator({ 
  isProcessing, 
  progress, 
  currentEmail, 
  totalEmails, 
  processed, 
  errors, 
  onCancel 
}) {
  if (!isProcessing) return null

  const progressPercentage = totalEmails > 0 ? (processed / totalEmails) * 100 : 0

  return (
    <div className="email-progress-overlay">
      <div className="email-progress-modal">
        <div className="email-progress-header">
          <h3>📧 กำลังบันทึกอีเมล</h3>
          {onCancel && (
            <button 
              className="email-cancel-btn" 
              onClick={onCancel}
              aria-label="ยกเลิกการบันทึกอีเมล"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="email-progress-body">
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
            <span className="progress-text">{Math.round(progressPercentage)}%</span>
          </div>
          
          <div className="email-current-item">
            {currentEmail && (
              <p>กำลังบันทึก: <strong>{currentEmail}</strong></p>
            )}
          </div>
          
          <div className="email-stats">
            <div className="stat-item">
              <span className="stat-label">ทั้งหมด:</span>
              <span className="stat-value">{totalEmails}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">เสร็จ:</span>
              <span className="stat-value processed">{processed}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">ข้อผิดพลาด:</span>
              <span className="stat-value errors">{errors}</span>
            </div>
          </div>
          
          <div className="email-time-estimate">
            {processed > 0 && totalEmails > processed && (
              <p>⏱️ ประมาณเวลาที่เหลือ: {estimateRemainingTime(processed, totalEmails)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function estimateRemainingTime(processed, total) {
  const remaining = total - processed
  const avgTimePerEmail = 500 // 0.5 วินาทีต่ออีเมล (ประมาณการ)
  const remainingMs = remaining * avgTimePerEmail
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  
  if (remainingSeconds < 60) {
    return `~${remainingSeconds} วินาที`
  } else {
    const minutes = Math.ceil(remainingSeconds / 60)
    return `~${minutes} นาที`
  }
}
