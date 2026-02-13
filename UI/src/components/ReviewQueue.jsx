import React, { useCallback, useEffect, useMemo, useState } from 'react'
import OcrProgressIndicator from './OcrProgressIndicator.jsx'
import { useOcrProgress } from '../hooks/useOcrProgress.js'

const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

export default function ReviewQueue({ onOpenEmail }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  
  // Use real-time OCR progress
  const { progress, isConnected, startOcr } = useOcrProgress()

  const [q, setQ] = useState('')
  const [hasAttachments, setHasAttachments] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('limit', '50')

    if (q && q.trim().length > 0) params.set('q', q.trim())
    if (hasAttachments !== '') params.set('hasAttachments', hasAttachments)
    if (ocrStatus !== '') params.set('ocrStatus', ocrStatus)
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) {
      // When toDate is the same as fromDate, we need to include the entire day
      // Use local timezone (Thailand UTC+7) instead of UTC
      const adjustedToDate = fromDate === toDate ? `${toDate}T23:59:59.999+07:00` : toDate
      params.set('toDate', adjustedToDate)
    }

    return params.toString()
  }, [q, hasAttachments, ocrStatus, fromDate, toDate])

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/review/emails?${queryString}`)
      if (!response.ok) throw new Error('Failed to fetch review emails')

      const data = await response.json()
      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setError(err)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [queryString])


  const handleOcrProcess = async () => {
    setOcrResult(null)
    setError(null)

    try {
      const result = await startOcr()
      console.log('✅ OCR started:', result)
      
      // Auto-refresh when OCR completes
      const checkInterval = setInterval(() => {
        if (!progress.isProcessing) {
          clearInterval(checkInterval)
          fetchItems()
          
          // Set final result
          setOcrResult({
            total: progress.totalFiles,
            processed: progress.processed,
            errors: progress.errors,
            skipped: Math.max(0, progress.totalFiles - progress.processed - progress.errors)
          })
        }
      }, 2000)
      
    } catch (err) {
      setError(err)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const getOcrStatusBadge = (status) => {
    const labels = {
      done: { text: 'เสร็จ', class: 'badge-done' },
      partial: { text: 'บางส่วน', class: 'badge-partial' },
      pending: { text: 'รอดำเนินการ', class: 'badge-pending' },
      none: { text: 'ไม่มี', class: 'badge-none' },
    };
    const { text, class: cls } = labels[status] || labels.none;
    return <span className={`badge ${cls}`}>{text}</span>;
  };

  return (
    <>
      <OcrProgressIndicator
        isProcessing={progress.isProcessing}
        currentFile={progress.currentFile}
        totalFiles={progress.totalFiles}
        processed={progress.processed}
        errors={progress.errors}
      />
      
      <section className="review-section">
      <div className="review-header">
        <div>
          <h2>👥 Review Queue</h2>
          <p>รายการอีเมลที่บันทึกแล้วสำหรับ HR Review</p>
          {isConnected && (
            <p className="connection-status">🟢 Real-time updates connected</p>
          )}
        </div>
        <div className="review-header-actions">
          <button 
            type="button" 
            className="primary-button" 
            onClick={handleOcrProcess} 
            disabled={progress.isProcessing || isLoading}
          >
            {progress.isProcessing ? '⏳ กำลังดึงข้อความ...' : '🔍 ดึงข้อความจากไฟล์'}
          </button>
          <button type="button" className="secondary-button" onClick={fetchItems} disabled={isLoading}>
            🔄 รีเฟรช
          </button>
        </div>
      </div>

      <div className="review-filters">
        <div className="review-filter">
          <label>
            ค้นหา (From/Subject)
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์เพื่อค้นหา..."
            />
          </label>
        </div>

        <div className="review-filter">
          <label>
            วันที่เริ่มต้น
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
            />
          </label>
        </div>

        <div className="review-filter">
          <label>
            วันที่สิ้นสุด
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
            />
          </label>
        </div>

        <div className="review-filter">
          <label>
            ไฟล์แนบ
            <select value={hasAttachments} onChange={(e) => setHasAttachments(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="true">มีไฟล์แนบ</option>
              <option value="false">ไม่มีไฟล์แนบ</option>
            </select>
          </label>
        </div>

        <div className="review-filter">
          <label>
            OCR
            <select value={ocrStatus} onChange={(e) => setOcrStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="done">เสร็จ</option>
              <option value="partial">บางส่วน</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="none">ไม่มี</option>
            </select>
          </label>
        </div>
      </div>

      {error && <div className="error-message" role="alert">❌ {error.message}</div>}

      {ocrResult && (
        <div className="ocr-result" role="status">
          <h4>🔍 ผลการดึงข้อความ</h4>
          <div className="ocr-stats">
            <span>✅ ประมวลผล: {ocrResult.processed || 0}</span>
            <span>⚠️ ข้าม: {ocrResult.skipped || 0}</span>
            <span>❌ ข้อผิดพลาด: {ocrResult.errors || 0}</span>
            <span>📊 ทั้งหมด: {ocrResult.total || 0}</span>
          </div>
        </div>
      )}

      <div className="review-table-wrapper">
        <table className="review-table">
          <thead>
            <tr>
              <th>วันที่รับ</th>
              <th>From</th>
              <th>Subject</th>
              <th>ไฟล์แนบ</th>
              <th>OCR</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="review-empty">กำลังโหลด...</td>
              </tr>
            )}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="review-empty">ยังไม่มีข้อมูล</td>
              </tr>
            )}

            {!isLoading &&
              items.map((row) => (
                <tr
                  key={row.id}
                  className="review-row"
                  onClick={() => onOpenEmail && onOpenEmail(row.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onOpenEmail && onOpenEmail(row.id)
                  }}
                >
                  <td>{formatDate(row.receivedAt)}</td>
                  <td className="review-cell-muted">{row.fromEmail}</td>
                  <td className="review-cell-subject">{row.subject || '(no subject)'}</td>
                  <td>{row.attachmentCount}</td>
                  <td>
                    {getOcrStatusBadge(row.ocrStatus)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      </section>
    </>
  )
}
