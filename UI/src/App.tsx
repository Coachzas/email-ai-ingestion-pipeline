import React, { useMemo, useEffect, lazy, Suspense, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import LoadingSpinner from './components/LoadingSpinner.tsx'
import SearchableLog from './components/SearchableLog.tsx'
import EmailSelection from './components/EmailSelection.tsx'
import { useEmailPipeline } from './hooks/useEmailPipeline'

// Lazy load components
const EmailDetails = lazy(() => import('./components/EmailDetails.tsx'))
const EmailHistory = lazy(() => import('./components/EmailHistory.tsx'))

export default function App() {
  const [showHistory, setShowHistory] = useState(false)
  const {
    startDate,
    endDate,
    log,
    isLoading,
    error,
    lastFetchedEmails,
    showEmailDetails,
    searchTerm,
    emailSummary,
    previewEmails,
    showEmailSelection,
    setStartDate,
    setEndDate,
    fetchEmailsPreview,
    saveSelectedEmails,
    clearError,
    showEmailDetailsModal,
    hideEmailDetailsModal,
    hideEmailSelectionModal,
    setSearchTerm,
    fetchEmailSummary
  } = useEmailPipeline()

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value)
  }

  const isFormValid = useMemo(() => {
    return Boolean(startDate || endDate)
  }, [startDate, endDate, isLoading])

  // ดึงข้อมูลสรุปเมื่อ component mount
  useEffect(() => {
    fetchEmailSummary()
  }, [])

  const buttonText = useMemo(() => {
    return isLoading ? '⏳ กำลังดำเนินการ...' : '📥 ดึงอีเมล'
  }, [isLoading])

  return (
    <ErrorBoundary>
      <div className="container">
        <header>
          <h1>📧 Email AI Pipeline</h1>
          <p>เลือกช่วงวันที่เพื่อดึงอีเมลจาก IMAP</p>
          <div className="header-buttons">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="history-button"
            >
              {showHistory ? '📥 ดึงอีเมล' : '📋 ประวัติอีเมล'}
            </button>
          </div>
        </header>

        {error && (
          <div 
            className="error-message" 
            role="alert" 
            aria-live="polite"
            id="error-message"
          >
            <span>❌ {error.message}</span>
            <button 
              onClick={clearError} 
              className="close-error"
              aria-label="ปิดข้อความแจ้งข้อผิดพลาด"
            >
              ×
            </button>
          </div>
        )}

        {showHistory ? (
          <Suspense fallback={<LoadingSpinner />}>
            <EmailHistory />
          </Suspense>
        ) : (
          <>
            <form className="controls" onSubmit={(e) => { e.preventDefault(); fetchEmailsPreview(); }}>
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
          </label>
          <button 
            type="submit" 
            disabled={isLoading || !isFormValid}
            aria-describedby="submit-description"
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
            <SearchableLog 
              content={log}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </div>
        </main>

        {showEmailDetails && lastFetchedEmails && (
          <Suspense fallback={<div className="modal-loading"><LoadingSpinner message="กำลังโหลดรายละเอียด..." /></div>}>
            <EmailDetails 
              emails={lastFetchedEmails} 
              emailSummary={emailSummary}
              onClose={hideEmailDetailsModal} 
            />
          </Suspense>
        )}

        {showEmailSelection && previewEmails && (
          <Suspense fallback={<div className="modal-loading"><LoadingSpinner message="กำลังโหลด..." /></div>}>
            <EmailSelection 
              emails={previewEmails}
              isLoading={isLoading}
              onClose={hideEmailSelectionModal}
              onSaveSelected={saveSelectedEmails}
            />
          </Suspense>
        )}
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}
