import React, { useMemo, useEffect, lazy, Suspense, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import EmailSelection from './components/EmailSelection.jsx'
import ReviewQueue from './components/ReviewQueue.jsx'
import ReviewEmailModal from './components/ReviewEmailModal.jsx'
import EmailProgressIndicator from './components/EmailProgressIndicator.jsx'
import AccountManager from './components/AccountManager.jsx'
import { useEmailPipeline } from './hooks/useEmailPipeline'

// Lazy load components
const EmailDetails = lazy(() => import('./components/EmailDetails.jsx'))

export default function App() {
  const [reviewEmailId, setReviewEmailId] = useState(null)
  const [currentView, setCurrentView] = useState('pipeline') // 'pipeline' or 'accounts'
  const [displayLimit, setDisplayLimit] = useState('all') // Limit for displaying in EmailSelection ('all' for no limit)

  const {
    startDate,
    endDate,
    log,
    isLoading,
    error,
    lastFetchedEmails,
    showEmailDetails,
    emailSummary,
    previewEmails,
    showEmailSelection,
    emailProgress,
    setStartDate,
    setEndDate,
    fetchEmailsPreview,
    saveSelectedEmails,
    clearError,
    showEmailDetailsModal,
    hideEmailDetailsModal,
    hideEmailSelectionModal,
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
          <nav className="main-nav">
            <button 
              className={`nav-button ${currentView === 'pipeline' ? 'active' : ''}`}
              onClick={() => setCurrentView('pipeline')}
            >
              📧 จัดการอีเมล
            </button>
            <button 
              className={`nav-button ${currentView === 'accounts' ? 'active' : ''}`}
              onClick={() => setCurrentView('accounts')}
            >
              🔧 จัดการบัญชี
            </button>
          </nav>
          {currentView === 'pipeline' && (
            <p>เลือกช่วงวันที่เพื่อดึงอีเมลจาก IMAP</p>
          )}
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

        {currentView === 'pipeline' ? (
          <>
            <form className="controls" onSubmit={(e) => { e.preventDefault(); fetchEmailsPreview(); }}>
              <label>
                วันที่เริ่มต้น
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
                วันที่สิ้นสุด
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={handleEndDateChange} 
                  disabled={isLoading}
                  aria-label="วันที่สิ้นสุด"
                  aria-describedby="end-date-description"
                />
              </label>
              <div className="fetch-email-container">
              <button 
                type="submit" 
                disabled={!isFormValid || isLoading}
                aria-describedby="submit-description"
              >
                {buttonText}
              </button>
              <select 
                value={displayLimit} 
                onChange={(e) => setDisplayLimit(e.target.value)}
                style={{ 
                  marginLeft: '8px', 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <option value="all">แสดงทั้งหมด</option>
                <option value={200}>แสดง: 200</option>
                <option value={100}>แสดง: 100</option>
                <option value={50}>แสดง: 50</option>
                <option value={10}>แสดง: 10</option>
              </select>
            </div>
            </form>

            <div id="log" role="log" aria-live="polite">
              <pre>{log}</pre>
            </div>

            {/* Email Progress Indicator */}
            <EmailProgressIndicator 
              isProcessing={emailProgress.isProcessing}
              progress={emailProgress.progress}
              currentEmail={emailProgress.currentEmail}
              totalEmails={emailProgress.totalEmails}
              processed={emailProgress.processed}
              errors={emailProgress.errors}
            />

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
                  emailLimit={displayLimit}
                />
              </Suspense>
            )}
          </>
        ) : (
          <AccountManager />
        )}

        {reviewEmailId && (
          <ReviewEmailModal emailId={reviewEmailId} onClose={closeReviewEmail} />
        )}
      </div>

      <style jsx>{`
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          background-color: #000;
          color: #fff;
        }
        
        .fetch-email-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fetch-email-container select {
          border: 1px solid #333;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          background: #111;
          color: #fff;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .fetch-email-container select:hover {
          border-color: #007bff;
        }

        .fetch-email-container select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
      `}</style>
    </ErrorBoundary>
  )
}
