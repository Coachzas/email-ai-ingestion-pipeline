import React, { useEffect, useState, useCallback } from 'react';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import ReviewEmailModal from './components/ReviewEmailModal.jsx';
import BatchSchedulerModal from './components/BatchSchedulerModal.jsx';
import BatchSchedulerList from './components/BatchSchedulerList.jsx';
import Login from './components/Login.jsx';

// Layout components
import { Navbar, StatusBar, ProgressIndicator } from './components/layout';
// View components
import { PipelineView, AccountsView, TokensView } from './components/views';

// Contexts and hooks
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { useBatchProgress } from './hooks';
import { useAppState, useBatchScheduler } from './hooks';

// Utils
import { formatThaiTime, getCountdown } from './utils';

function AuthenticatedApp() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const {
    currentView,
    reviewEmailId,
    showBatchScheduler,
    showBatchSchedulerList,
    editScheduler,
    setCurrentView,
    openReviewEmail,
    closeReviewEmail,
    openBatchScheduler,
    closeBatchScheduler,
    openBatchSchedulerList,
    closeBatchSchedulerList,
    handleReviewQueueItems,
  } = useAppState();

  const { 
    schedulers, 
    saveScheduler, 
    nextBatchRun, 
    nextBatchName,
    updateNextRun 
  } = useBatchScheduler();

  const {
    isProcessing,
    currentItem,
    processedEmails,
    skippedEmails,
    getOverallProgress,
    getPhaseText,
  } = useBatchProgress();

  const [now, setNow] = useState(() => new Date());

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate countdown
  const nextBatchCountdown = getCountdown(nextBatchRun, now);

  // Handle scheduler operations
  const handleEditScheduler = useCallback((scheduler) => {
    openBatchScheduler(scheduler);
  }, [openBatchScheduler]);

  const handleSaveScheduler = useCallback(async (data) => {
    const result = await saveScheduler(data);
    
    if (result.success) {
      const message = editScheduler 
        ? '✅ อัปเดต Batch Scheduler สำเร็จแล้ว!'
        : '✅ บันทึก Batch Scheduler สำเร็จแล้ว!';
      
      alert(message);
      closeBatchScheduler();
      
      // Refresh scheduler list if open
      if (showBatchSchedulerList) {
        closeBatchSchedulerList();
        setTimeout(openBatchSchedulerList, 100);
      }
    } else {
      alert(`❌ เกิดข้อผิดพลาด: ${result.error}`);
    }
  }, [saveScheduler, editScheduler, closeBatchScheduler, showBatchSchedulerList, closeBatchSchedulerList, openBatchSchedulerList]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
        กำลังโหลด...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'pipeline':
        return (
          <PipelineView
            now={now}
            nextBatchRunAt={nextBatchRun}
            nextBatchName={nextBatchName}
            nextBatchCountdown={nextBatchCountdown}
            formatThaiTime={formatThaiTime}
            isProcessing={isProcessing}
            currentItem={currentItem}
            getPhaseText={getPhaseText}
            getOverallProgress={getOverallProgress}
            skippedEmails={skippedEmails}
            onOpenBatchSchedulerList={openBatchSchedulerList}
            onOpenEmail={openReviewEmail}
            onItemsChange={handleReviewQueueItems}
            disabled={isProcessing}
          />
        );
      case 'accounts':
        return <AccountsView />;
      case 'tokens':
        return <TokensView />;
      default:
        return <PipelineView />;
    }
  };

  return (
    <>
      <ErrorBoundary>
        <div className="app">
          <Navbar
            currentView={currentView}
            onViewChange={setCurrentView}
            user={user}
            onLogout={logout}
          />

          <div className="px-5">
            {renderCurrentView()}
          </div>

          {/* Modals */}
          {reviewEmailId && (
            <ReviewEmailModal
              email={{ id: reviewEmailId }}
              onClose={closeReviewEmail}
            />
          )}

          <BatchSchedulerList
            isOpen={showBatchSchedulerList}
            onClose={closeBatchSchedulerList}
            onEdit={handleEditScheduler}
          />

          <BatchSchedulerModal
            isOpen={showBatchScheduler}
            editScheduler={editScheduler}
            onClose={closeBatchScheduler}
            onSave={handleSaveScheduler}
          />
        </div>
      </ErrorBoundary>
    </>
  );
}

// Main App component with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AuthenticatedApp />
      </ErrorBoundary>
    </AuthProvider>
  );
}
