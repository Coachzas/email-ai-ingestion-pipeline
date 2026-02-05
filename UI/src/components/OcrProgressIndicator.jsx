import React from 'react'

export default function OcrProgressIndicator({ 
  isProcessing, 
  progress, 
  currentFile, 
  totalFiles, 
  processed, 
  errors, 
  onCancel 
}) {
  if (!isProcessing) return null

  const progressPercentage = totalFiles > 0 ? (processed / totalFiles) * 100 : 0

  return (
    <div className="ocr-progress-overlay">
      <div className="ocr-progress-modal">
        <div className="ocr-progress-header">
          <h3>🔍 กำลังทำ OCR</h3>
          {onCancel && (
            <button 
              className="ocr-cancel-btn" 
              onClick={onCancel}
              aria-label="ยกเลิกการทำ OCR"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="ocr-progress-body">
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
            <span className="progress-text">{Math.round(progressPercentage)}%</span>
          </div>
          
          <div className="ocr-current-file">
            {currentFile && (
              <p>กำลังประมวลผล: <strong>{currentFile}</strong></p>
            )}
          </div>
          
          <div className="ocr-stats">
            <div className="stat-item">
              <span className="stat-label">ทั้งหมด:</span>
              <span className="stat-value">{totalFiles}</span>
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
          
          <div className="ocr-time-estimate">
            {processed > 0 && totalFiles > processed && (
              <p>⏱️ ประมาณเวลาที่เหลือ: {estimateRemainingTime(processed, totalFiles)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function estimateRemainingTime(processed, total) {
  const remaining = total - processed
  const avgTimePerFile = 2000 // 2 วินาทีต่อไฟล์ (ประมาณการ)
  const remainingMs = remaining * avgTimePerFile
  const remainingSeconds = Math.ceil(remainingMs / 1000)
  
  if (remainingSeconds < 60) {
    return `~${remainingSeconds} วินาที`
  } else {
    const minutes = Math.ceil(remainingSeconds / 60)
    return `~${minutes} นาที`
  }
}
