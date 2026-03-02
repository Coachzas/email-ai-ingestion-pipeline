import React, { useMemo, useEffect, lazy, Suspense, useState, useCallback } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import EmailSelection from './components/EmailSelection.jsx'
import ReviewQueue from './components/ReviewQueue.jsx'
import ReviewEmailModal from './components/ReviewEmailModal.jsx'
import EmailProgressIndicator from './components/EmailProgressIndicator.jsx'
import AccountManager from './components/AccountManager.jsx'
import TokenUsage from './components/TokenUsage.jsx'
import AiResumeAnalyzer from './components/AiResumeAnalyzer.jsx'
import AiAnalysisProgress from './components/AiAnalysisProgress.jsx'
import AiAnalysisResults from './components/AiAnalysisResults.jsx'
import { useEmailPipeline } from './hooks/useEmailPipeline'
import { useAiAnalyzer } from './hooks/useAiAnalyzer'

// Lazy load components

export default function App() {
  console.log('App component rendering...');
  
  const [reviewEmailId, setReviewEmailId] = useState(null)
  const [currentView, setCurrentView] = useState('pipeline') // 'pipeline', 'accounts', or 'tokens'
  const [reviewQueueItems, setReviewQueueItems] = useState([])

  try {

  const {
    startDate,
    endDate,
    isLoading,
    log,
    error,
    previewEmails,
    showEmailSelection,
    emailProgress,
    setStartDate,
    setEndDate,
    fetchEmailsPreview,
    saveSelectedEmails,
    clearError,
    hideEmailSelectionModal
  } = useEmailPipeline()

  const {showAiAnalyzer,
    openAiAnalyzer,
    closeAiAnalyzer,
    analysisProgress,
    startAnalysis,
    analysisResults,
    showResults,
    closeResults
  } = useAiAnalyzer()

  // Debug previewEmails
  console.log('App render - previewEmails:', previewEmails);
  console.log('App render - previewEmails length:', previewEmails?.length);
  console.log('App render - button disabled:', !previewEmails || previewEmails.length === 0);

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value)
  }

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value)
  }

  const handleReviewQueueItems = useCallback((items) => {
    setReviewQueueItems(items)
  }, [])

  const isFormValid = useMemo(() => {
    return Boolean(startDate || endDate)
  }, [startDate, endDate, isLoading])

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
      <div className="app">
        <nav style={{ 
          padding: '10px 20px', 
          backgroundColor: '#111', 
          borderBottom: '1px solid #333',
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <button 
            onClick={() => setCurrentView('pipeline')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'pipeline' ? '#007bff' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            📧 จัดการอีเมล
          </button>
          <button 
            onClick={() => setCurrentView('accounts')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'accounts' ? '#007bff' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            👤 Accounts
          </button>
          <button 
            onClick={() => setCurrentView('tokens')}
            style={{
              padding: '8px 16px',
              backgroundColor: currentView === 'tokens' ? '#007bff' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📊 Token Usage
          </button>
        </nav>

        <div style={{ padding: '0 20px' }}>
          {currentView === 'pipeline' && (
            <p style={{ color: '#ccc', marginBottom: '20px' }}>เลือกช่วงวันที่เพื่อดึงอีเมลจาก IMAP</p>
          )}

          {currentView === 'pipeline' && (
            <>
              {error && (
                <div 
                  className="error-message" 
                  role="alert" 
                  aria-live="polite"
                  id="error-message"
                  style={{ 
                    backgroundColor: '#dc3545', 
                    color: '#fff', 
                    padding: '10px', 
                    borderRadius: '4px', 
                    marginBottom: '20px' 
                  }}
                >
                  <span>❌ {error.message}</span>
                  <button 
                    onClick={clearError} 
                    className="close-error"
                    aria-label="ปิดข้อความแจ้งข้อผิดพลาด"
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#fff', 
                      fontSize: '18px', 
                      cursor: 'pointer',
                      marginLeft: '10px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

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

              <ReviewQueue onOpenEmail={openReviewEmail} onOpenAiAnalyzer={openAiAnalyzer} onItemsChange={handleReviewQueueItems} />

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

              {/* AI Resume Analyzer Modal */}
              {showAiAnalyzer && (
                <AiResumeAnalyzer
                  isOpen={showAiAnalyzer}
                  onClose={closeAiAnalyzer}
                  items={reviewQueueItems}
                  onAnalyze={startAnalysis}
                />
              )}
            </>
          )}

          {currentView === 'accounts' && (
            <AccountManager />
          )}

          {currentView === 'tokens' && (
            <TokenUsage />
          )}

          {reviewEmailId && (
            <ReviewEmailModal emailId={reviewEmailId} onClose={closeReviewEmail} />
          )}

          {/* AI Analysis Progress Modal */}
          {analysisProgress.isProcessing && (
            <AiAnalysisProgress 
              analysisProgress={analysisProgress}
            />
          )}

          {/* AI Analysis Results Modal */}
          {showResults && analysisResults && (
            <AiAnalysisResults 
              results={analysisResults}
              onClose={closeResults}
            />
          )}
        
        </div>
        </div>
          
        <style jsx>{`
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
            'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
            sans-serif;
          background-color: #1a1a1a;
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
          opacity: 1;
          pointer-events: auto;
        }

        .fetch-email-container select:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          pointer-events: none;
        }

        .fetch-email-container select:hover {
          border-color: #007bff;
        }

        .fetch-email-container select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }

        .ai-analyzer-section {
          margin: 20px 0 !important;
          text-align: center !important;
          width: 100% !important;
          display: block !important;
          clear: both !important;
        }

        .ai-analyzer-btn {
          padding: 10px 20px !important;
          background: #007bff !important;
          color: white !important;
          border: none !important;
          border-radius: 4px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          margin: 10px auto !important;
          transition: all 0.2s ease !important;
          display: inline-block !important;
          position: relative !important;
          float: none !important;
          left: auto !important;
          right: auto !important;
        }

        .ai-analyzer-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .ai-analyzer-btn:disabled {
          background: #666;
          cursor: not-allowed;
        }
      `}</style>
    </ErrorBoundary>
  )
  } catch (error) {
    console.error('App component error:', error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
        <pre>{error.stack}</pre>
      </div>
    );
  }
}
