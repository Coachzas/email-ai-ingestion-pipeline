import React, { useState, useCallback } from 'react'

export default function AiResumeAnalyzer({ 
  isOpen, 
  onClose, 
  items = [],
  onAnalyze 
}) {
  const [criteriaFile, setCriteriaFile] = useState(null)
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [extractPersonalInfo, setExtractPersonalInfo] = useState(true)
  const [extractSkills, setExtractSkills] = useState(true)
  const [scoreWithCriteria, setScoreWithCriteria] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleCriteriaUpload = useCallback((e) => {
    const file = e.target.files[0]
    if (file) {
      setCriteriaFile(file)
    }
  }, [])

  const handleItemSelect = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const handleSelectAllItems = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(items.map(item => item.id)))
    }
  }, [items, selectedItems])

  const startAnalysis = useCallback(() => {
    if (!criteriaFile || selectedItems.size === 0) return
    
    setIsAnalyzing(true)
    const selectedItemsArray = items.filter(item => selectedItems.has(item.id))
    
    // Call the onAnalyze function with proper parameters
    onAnalyze(criteriaFile, selectedItemsArray, {
      extractPersonalInfo,
      extractSkills,
      scoreWithCriteria
    })
  }, [criteriaFile, selectedItems, items, extractPersonalInfo, extractSkills, scoreWithCriteria, onAnalyze])

  if (!isOpen) {
    console.log('AiResumeAnalyzer: isOpen is false, not rendering');
    return null
  }
  
  console.log('AiResumeAnalyzer: isOpen is true, rendering modal');

  return (
    <div className="modal-overlay">
      <div className="ai-analyzer-modal">
        <div className="modal-header">
          <h3>🤖 AI Resume Analyzer</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* Upload Criteria Sheet */}
          <div className="criteria-upload">
            <h4>📋 อัปโหลดเกณฑ์การประเมิน</h4>
            <div className="upload-area">
              <input 
                type="file" 
                id="criteria-file"
                accept=".xlsx,.csv,.json"
                onChange={handleCriteriaUpload}
                style={{ display: 'none' }}
              />
              <label htmlFor="criteria-file" className="upload-label">
                {criteriaFile ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{criteriaFile.name}</span>
                    <span className="file-size">({(criteriaFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="upload-prompt">
                    <span className="upload-icon">📁</span>
                    <span>คลิกเพื่ออัปโหลดไฟล์เกณฑ์</span>
                    <span className="upload-hint">รองรับ .xlsx, .csv, .json</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Select Items to Analyze */}
          <div className="email-selection">
            <h4>📧 เลือกอีเมลที่ต้องการวิเคราะห์</h4>
            <div className="selection-controls">
              <button 
                className="select-all-btn"
                onClick={handleSelectAllItems}
              >
                {selectedItems.size === items.length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
              <span className="selection-count">
                เลือก {selectedItems.size} จาก {items.length} อีเมล
              </span>
            </div>
            
            <div className="email-list">
              {items.map(item => (
                <div key={item.id} className="email-item">
                  <input
                    type="checkbox"
                    id={`item-${item.id}`}
                    checked={selectedItems.has(item.id)}
                    onChange={() => handleItemSelect(item.id)}
                  />
                  <label htmlFor={`item-${item.id}`} className="email-label">
                    <div className="email-info">
                      <div className="email-subject">{item.subject}</div>
                      <div className="email-from">{item.fromEmail || item.from}</div>
                      <div className="email-meta">
                        <span className="email-date">
                          {item.receivedAt ? new Date(item.receivedAt).toLocaleDateString('th-TH') : 'ไม่ระบุวันที่'}
                        </span>
                        {item.attachmentCount > 0 && (
                          <span className="attachment-count">
                            📎 {item.attachmentCount} ไฟล์
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis Options */}
          <div className="analysis-options">
            <h4>⚙️ ตัวเลือกการวิเคราะห์</h4>
            <div className="options-grid">
              <label className="option-item">
                <input
                  type="checkbox"
                  checked={extractPersonalInfo}
                  onChange={(e) => setExtractPersonalInfo(e.target.checked)}
                />
                <div className="option-content">
                  <span className="option-title">📝 ดึงข้อมูลส่วนตัว</span>
                  <span className="option-desc">ชื่อ, ตำแหน่ง, ข้อมูลติดต่อ</span>
                </div>
              </label>
              
              <label className="option-item">
                <input
                  type="checkbox"
                  checked={extractSkills}
                  onChange={(e) => setExtractSkills(e.target.checked)}
                />
                <div className="option-content">
                  <span className="option-title">🔧 ดึงทักษะและประสบการณ์</span>
                  <span className="option-desc">ทักษะ, ประสบการณ์, โปรเจค</span>
                </div>
              </label>
              
              <label className="option-item">
                <input
                  type="checkbox"
                  checked={scoreWithCriteria}
                  onChange={(e) => setScoreWithCriteria(e.target.checked)}
                />
                <div className="option-content">
                  <span className="option-title">📊 ให้คะแนนตามเกณฑ์</span>
                  <span className="option-desc">จับคู่กับเกณฑ์และให้คะแนน</span>
                </div>
              </label>
            </div>
          </div>

          {/* Start Analysis Button */}
          <div className="action-section">
            <button 
              className="start-analysis-btn"
              onClick={startAnalysis}
              disabled={!criteriaFile || selectedItems.size === 0 || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <span className="loading-spinner"></span>
                  กำลังวิเคราะห์...
                </>
              ) : (
                <>
                  🚀 เริ่มการวิเคราะห์
                </>
              )}
            </button>
            
            <div className="analysis-summary">
              {criteriaFile && (
                <span className="summary-item">
                  ✅ เกณฑ์: {criteriaFile.name}
                </span>
              )}
              {selectedItems.size > 0 && (
                <span className="summary-item">
                  ✅ อีเมล: {selectedItems.size} ฉบับ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Add styles to make email items equal height
const style = document.createElement('style');
style.textContent = `
  .email-item {
    min-height: 100px;
    height: auto;
    display: flex;
    align-items: stretch;
  }
  
  .email-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  
  .email-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 76px;
  }
`;
document.head.appendChild(style);
