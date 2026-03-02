import React from 'react'

export default function AiAnalysisProgress({ 
  analysisProgress 
}) {
  if (!analysisProgress || !analysisProgress.isProcessing) return null

  const { currentEmail, totalEmails, processed, errors } = analysisProgress
  const progressPercentage = totalEmails > 0 ? (processed / totalEmails) * 100 : 0

  return (
    <div className="ai-progress-overlay">
      <div className="ai-progress-modal">
        <div className="progress-header">
          <h3>🤖 กำลังวิเคราะห์ Resume...</h3>
        </div>
        
        <div className="progress-body">
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
            <span className="progress-text">{Math.round(progressPercentage)}%</span>
          </div>
          
          <div className="current-item">
            <p>กำลังวิเคราะห์: <strong>{currentEmail}</strong></p>
          </div>
          
          <div className="progress-stats">
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
          
          <div className="time-estimate">
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
  const avgTimePerEmail = 2000 // 2 วินาทีต่ออีเมล (AI ใช้เวลานานกว่า OCR)
  const remainingMs = remaining * avgTimePerEmail
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  
  if (remainingSeconds < 60) {
    return `~${remainingSeconds} วินาที`
  } else {
    const minutes = Math.ceil(remainingSeconds / 60)
    return `~${minutes} นาที`
  }
}
