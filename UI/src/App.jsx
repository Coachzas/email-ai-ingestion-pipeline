import React, { useMemo, useEffect, lazy, Suspense, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import SearchableLog from './components/SearchableLog.jsx'
import EmailSelection from './components/EmailSelection.jsx'
import ReviewQueue from './components/ReviewQueue.jsx'
import ReviewEmailModal from './components/ReviewEmailModal.jsx'
import { useEmailPipeline } from './hooks/useEmailPipeline'

// Lazy load components
const EmailDetails = lazy(() => import('./components/EmailDetails.jsx'))

export default function App() {
  const [reviewEmailId, setReviewEmailId] = useState(null)

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

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value)
  }

  const handleEndDateChange = (e) => {
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

  const openReviewEmail = (id) => {
    setReviewEmailId(id)
  }

  const closeReviewEmail = () => {
    setReviewEmailId(null)
  }

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
            disabled={!isFormValid || isLoading}
            aria-describedby="submit-description"
          >
            {buttonText}
          </button>
        </form>

        <div id="log" role="log" aria-live="polite">
          <SearchableLog 
            log={log} 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
          />
        </div>

        <ReviewQueue onOpenEmail={openReviewEmail} />

        {showEmailDetails && lastFetchedEmails && (
          <Suspense fallback={<div className="modal-loading"><LoadingSpinner message="กำลังโหลด..." /></div>}>
            <EmailDetails 
              emails={lastFetchedEmails.emails}
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

        {reviewEmailId && (
          <ReviewEmailModal emailId={reviewEmailId} onClose={closeReviewEmail} />
        )}
      </div>
    </ErrorBoundary>
  )
}
