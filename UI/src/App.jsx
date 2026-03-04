import React, { useMemo, useEffect, lazy, Suspense, useState, useCallback } from 'react'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import ReviewQueue from './components/ReviewQueue.jsx'
import ReviewEmailModal from './components/ReviewEmailModal.jsx'
import EmailProgressIndicator from './components/EmailProgressIndicator.jsx'
import AccountManager from './components/AccountManager.jsx'
import TokenUsage from './components/TokenUsage.jsx'
import BatchSchedulerModal from './components/BatchSchedulerModal.jsx'
import BatchSchedulerList from './components/BatchSchedulerList.jsx'
import { useEmailPipeline } from './hooks/useEmailPipeline'

// Lazy load components

export default function App() {
  console.log('App component rendering...');
  
  const [reviewEmailId, setReviewEmailId] = useState(null)
  const [currentView, setCurrentView] = useState('pipeline') // 'pipeline', 'accounts', or 'tokens'
  const [reviewQueueItems, setReviewQueueItems] = useState([])
  const [showBatchScheduler, setShowBatchScheduler] = useState(false)
  const [showBatchSchedulerList, setShowBatchSchedulerList] = useState(false)

  const [now, setNow] = useState(() => new Date())
  const [nextBatchRunAt, setNextBatchRunAt] = useState(null)
  const [nextBatchName, setNextBatchName] = useState(null)

  try {

  const {
    isLoading,
    log,
    error,
    emailProgress,
    clearError
  } = useEmailPipeline()

  const handleReviewQueueItems = useCallback((items) => {
    setReviewQueueItems(items)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    const pickNearestNextRun = (statusData) => {
      const schedulers = statusData?.activeSchedulers || []
      const candidates = schedulers
        .map((s) => ({
          name: s?.name || null,
          nextRunAt: s?.nextRunAt ? new Date(s.nextRunAt) : null,
        }))
        .filter((x) => x.nextRunAt && !Number.isNaN(x.nextRunAt.getTime()))

      if (!candidates.length) return { nextRunAt: null, name: null }

      candidates.sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
      return { nextRunAt: candidates[0].nextRunAt, name: candidates[0].name }
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/batch-schedulers/status')
        const result = await response.json()
        if (!isMounted) return

        if (result?.success) {
          const picked = pickNearestNextRun(result.data)
          setNextBatchRunAt(picked.nextRunAt)
          setNextBatchName(picked.name)
        }
      } catch (e) {
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const formatThaiTime = useCallback((date) => {
    try {
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date)
    } catch {
      return date.toLocaleString('th-TH')
    }
  }, [])

  const nextBatchCountdown = useMemo(() => {
    if (!nextBatchRunAt) return null
    const diffMs = nextBatchRunAt.getTime() - now.getTime()
    if (diffMs <= 0) return 'กำลังเริ่มทำงาน...'

    const totalSeconds = Math.floor(diffMs / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const parts = []
    if (days) parts.push(`${days} วัน`)
    if (hours || days) parts.push(`${String(hours).padStart(2, '0')} ชม.`)
    parts.push(`${String(minutes).padStart(2, '0')} นาที`)
    parts.push(`${String(seconds).padStart(2, '0')} วิ`)
    return parts.join(' ')
  }, [nextBatchRunAt, now])

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
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            📊 Token Usage
          </button>
                  </nav>

        <div style={{ padding: '0 20px' }}>
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

                                <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}>
                  <button 
                    type="button"
                    onClick={() => setShowBatchSchedulerList(true)}
                    disabled={isLoading}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      opacity: isLoading ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    📅 Batch Scheduler
                  </button>
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#111',
                        border: '1px solid #333',
                        borderRadius: '10px',
                        minWidth: '260px'
                      }}
                    >
                      <div style={{ color: '#bbb', fontSize: '12px' }}>เวลาปัจจุบัน</div>
                      <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                        {formatThaiTime(now)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#bbb', fontSize: '12px' }}>รอบถัดไป</div>
                          <div style={{ color: '#4dabf7', fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                            {nextBatchRunAt ? formatThaiTime(nextBatchRunAt) : '-'}
                          </div>
                          <div style={{ color: '#bbb', fontSize: '12px', marginTop: '2px' }}>
                            {nextBatchCountdown ? `อีก ${nextBatchCountdown}` : ''}
                          </div>
                        </div>
                        <div style={{ width: '110px', textAlign: 'right' }}>
                          <div style={{ color: '#bbb', fontSize: '12px' }}>Scheduler</div>
                          <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {nextBatchName || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

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

              <ReviewQueue onOpenEmail={openReviewEmail} onItemsChange={handleReviewQueueItems} />

              
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

                  
        </div>
        </div>

        {/* Batch Scheduler List Modal */}
        <BatchSchedulerList
          isOpen={showBatchSchedulerList}
          onClose={() => setShowBatchSchedulerList(false)}
          onEdit={() => {
            setShowBatchSchedulerList(false);
            setShowBatchScheduler(true);
          }}
        />

        {/* Batch Scheduler Modal - Moved outside main container for proper overlay */}
        <BatchSchedulerModal
          isOpen={showBatchScheduler}
          onClose={() => setShowBatchScheduler(false)}
          onSave={async (data) => {
            try {
              const response = await fetch('/api/batch-schedulers', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: data.name,
                  batchSize: data.batchSize,
                  scheduleType: data.scheduleType,
                  customHour: data.customHour,
                  customMinute: data.customMinute,
                  startDate: data.startDate,
                  endDate: data.endDate || null
                })
              });

              const result = await response.json();
              
              if (result.success) {
                console.log('Batch Scheduler saved successfully:', result.data);
                alert('✅ บันทึก Batch Scheduler สำเร็จแล้ว!');
                setShowBatchScheduler(false);
              } else {
                console.error('Failed to save scheduler:', result);
                alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
              }
            } catch (error) {
              console.error('Error saving scheduler:', error);
              alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
            }
          }}
        />
          
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
