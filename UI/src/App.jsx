import React, { useState, useCallback, useMemo } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'

export default function App() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [log, setLog] = useState('รอคำสั่ง...')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchEmails = useCallback(async () => {
    if (isLoading) return
    
    setIsLoading(true)
    setError(null)
    setLog('⏳ กำลังดึงอีเมล...')
    
    try {
      const res = await fetch('/api/ingest/fetch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null }),
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`)
      }

      // Defensive response handling: some errors or empty responses may not be JSON
      const text = await res.text()
      if (!text) {
        setLog(`Status: ${res.status} ${res.statusText} (empty response)`)
        return
      }

      try {
        const data = JSON.parse(text)
        
        // Format display with email count and nice structure
        let displayText = '✅ สำเร็จ\n\n'
        displayText += `📊 จำนวนอีเมล: ${data.emailCount || 0}\n\n`
        
        if (data.emails && data.emails.length > 0) {
          displayText += '📧 รายละเอียดอีเมล:\n'
          displayText += JSON.stringify(data.emails, null, 2)
          displayText += '\n\n'
        }
        
        if (data.ocr) {
          displayText += '📎 สถานะ OCR:\n'
          displayText += JSON.stringify({
            total: data.ocr.total,
            processed: data.ocr.processed,
            successful: data.ocr.successful,
            errors: data.ocr.errors,
            results: data.ocr.results
          }, null, 2)
        }
        
        setLog(displayText)
      } catch (e) {
        // not JSON
        setLog(`Status: ${res.status} ${res.statusText}\n\n` + text)
      }
    } catch (err) {
      const errorMessage = err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
      setError(errorMessage)
      setLog('❌ Error: ' + errorMessage)
      console.error('Fetch emails error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate, isLoading])

  const handleStartDateChange = useCallback((e) => {
    setStartDate(e.target.value)
  }, [])

  const handleEndDateChange = useCallback((e) => {
    setEndDate(e.target.value)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const isFormValid = useMemo(() => {
    return startDate || endDate
  }, [startDate, endDate])

  const buttonText = useMemo(() => {
    return isLoading ? '⏳ กำลังดำเนินการ...' : '📥 ดึงอีเมล'
  }, [isLoading])

  return (
    <ErrorBoundary>
      <div className="container">
        <header>
          <h1>📧 Email AI Pipeline</h1>
          <p>เลือกช่วงวันที่เพื่อดึงอีเมลจาก IMAP</p>
        </header>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
            <button onClick={clearError} className="close-error">×</button>
          </div>
        )}

        <section className="controls">
          <label>
            เริ่มต้น
            <input 
              type="date" 
              value={startDate} 
              onChange={handleStartDateChange} 
              disabled={isLoading}
              aria-label="วันที่เริ่มต้น"
            />
          </label>
          <label>
            สิ้นสุด
            <input 
              type="date" 
              value={endDate} 
              onChange={handleEndDateChange} 
              disabled={isLoading}
              aria-label="วันที่สิ้นสุด"
            />
          </label>
          <button 
            onClick={fetchEmails} 
            disabled={!isFormValid || isLoading}
            aria-busy={isLoading}
            aria-describedby={error ? 'error-message' : undefined}
          >
            {isLoading && <LoadingSpinner size="small" />}
            {buttonText}
          </button>
        </section>

        <main>
          <pre id="log" role="log" aria-live="polite">{log}</pre>
        </main>
      </div>
    </ErrorBoundary>
  )
}
