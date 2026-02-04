import React, { useMemo, lazy, Suspense } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingSpinner from './components/LoadingSpinner'
import { useEmailPipeline } from './hooks/useEmailPipeline'

// Lazy load the EmailDetails component for better bundle splitting
const EmailDetails = lazy(() => import('./components/EmailDetails'))

export default function App() {
  const {
    startDate,
    endDate,
    log,
    isLoading,
    error,
    lastFetchedEmails,
    showEmailDetails,
    setStartDate,
    setEndDate,
    fetchEmails,
    clearError,
    showEmailDetailsModal,
    hideEmailDetailsModal
  } = useEmailPipeline()

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value)
  }

  const isFormValid = useMemo(() => {
    return Boolean(startDate || endDate)
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
          <div 
            className="error-message" 
            role="alert" 
            aria-live="polite"
            id="error-message"
          >
            <span>❌ {error}</span>
            <button 
              onClick={clearError} 
              className="close-error"
              aria-label="ปิดข้อความแจ้งข้อผิดพลาด"
            >
              ×
            </button>
          </div>
        )}

        <form className="controls" onSubmit={(e) => { e.preventDefault(); fetchEmails(); }}>
          <label>
            เริ่มต้น
            <input 
              type="date" 
              value={startDate} 
              onChange={handleStartDateChange} 
              disabled={isLoading}
              aria-label="วันที่เริ่มต้น"
              aria-describedby="start-date-description"
            />
            <span id="start-date-description" className="sr-only">
              เลือกวันที่เริ่มต้นสำหรับดึงอีเมล
            </span>
          </label>
          <label>
            สิ้นสุด
            <input 
              type="date" 
              value={endDate} 
              onChange={handleEndDateChange} 
              disabled={isLoading}
              aria-label="วันที่สิ้นสุด"
              aria-describedby="end-date-description"
            />
            <span id="end-date-description" className="sr-only">
              เลือกวันที่สิ้นสุดสำหรับดึงอีเมล
            </span>
          </label>
          <button 
            type="submit"
            disabled={!isFormValid || isLoading}
            aria-busy={isLoading}
            aria-describedby={error ? 'error-message' : undefined}
          >
            {isLoading && <LoadingSpinner size="small" />}
            {buttonText}
          </button>
          {lastFetchedEmails && lastFetchedEmails.length > 0 && (
            <button 
              onClick={showEmailDetailsModal}
              disabled={isLoading}
              className="secondary-button"
              type="button"
              aria-label={`ดูรายละเอียดอีเมล ${lastFetchedEmails.length} ฉบับ`}
            >
              📋 ดูรายละเอียดอีเมล ({lastFetchedEmails.length})
            </button>
          )}
        </form>

        <main>
          <div className="log-container">
            <h2 className="sr-only">ผลลัพธ์การดำเนินการ</h2>
            <pre 
              id="log" 
              role="log" 
              aria-live="polite"
              aria-label="บันทึกการดำเนินการ"
              tabIndex={0}
            >
              {log}
            </pre>
          </div>
        </main>

        {showEmailDetails && lastFetchedEmails && (
          <Suspense fallback={<div className="modal-loading"><LoadingSpinner message="กำลังโหลดรายละเอียด..." /></div>}>
            <EmailDetails 
              emails={lastFetchedEmails} 
              onClose={hideEmailDetailsModal} 
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  )
}
