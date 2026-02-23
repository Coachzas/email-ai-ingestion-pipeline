import React from 'react'

export default function OcrProgressIndicator({ 
  isProcessing, 
  currentFile, 
  totalFiles, 
  processed, 
  errors, 
  onCancel 
}) {
  if (!isProcessing) return null

  return (
    <div className="ocr-progress-overlay">
      <div className="ocr-progress-modal">
        <div className="ocr-progress-header">
          <h3>🔍 กำลังดึงข้อความจากไฟล์</h3>
          {onCancel && (
            <button 
              className="ocr-cancel-btn" 
              onClick={onCancel}
              aria-label="ยกเลิกการดึงข้อความ"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="ocr-progress-body">
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
              <span className="stat-label">ไม่สามารถดึงข้อความ:</span>
              <span className="stat-value errors">{errors}</span>
            </div>
          </div>
          
          <div className="ocr-time-estimate">
            <p className="ocr-note">📄 รองรับไฟล์ PDF, DOCX, XLSX, PPTX, CSV และรูปภาพ</p>
          </div>
        </div>
      </div>
    </div>
  )
}
