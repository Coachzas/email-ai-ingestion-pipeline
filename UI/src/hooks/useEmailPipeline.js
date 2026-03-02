import { useState, useCallback, useEffect } from 'react'

export const useEmailPipeline = () => {
  const initialState = {
    startDate: '',
    endDate: '',
    isLoading: false,
    log: '',
    error: null,
    previewEmails: null,
    showEmailSelection: false,
    // Email saving progress state
    emailProgress: {
      isProcessing: false,
      progress: 0,
      currentEmail: '',
      totalEmails: 0,
      processed: 0,
      errors: 0
    }
  }

  const [state, setState] = useState(initialState)

  // SSE connection for email progress
  useEffect(() => {
    let eventSource

    const connectEmailProgress = () => {
      eventSource = new EventSource('/api/email-progress/progress')
      
      eventSource.onmessage = (event) => {
        try {
          const progressData = JSON.parse(event.data)
          setState(prev => ({
            ...prev,
            emailProgress: {
              ...prev.emailProgress,
              ...progressData,
              progress: progressData.totalEmails > 0 
                ? Math.round((progressData.processed / progressData.totalEmails) * 100)
                : 0
            }
          }))
        } catch (err) {
          // Silently ignore parsing errors
        }
      }

      eventSource.onerror = (err) => {
        eventSource?.close()
        setTimeout(connectEmailProgress, 3000)
      }
    }

    connectEmailProgress()

    return () => {
      eventSource?.close()
    }
  }, [])

  const setStartDate = useCallback((date) => {
    setState(prev => ({ ...prev, startDate: date }))
  }, [])

  const setEndDate = useCallback((date) => {
    setState(prev => ({ ...prev, endDate: date }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const hideEmailSelectionModal = useCallback(() => {
    setState(prev => ({ ...prev, showEmailSelection: false, previewEmails: null }))
  }, [])

  const fetchEmailsPreview = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null, log: 'กำลังเชื่อมต่อ IMAP...\n' }))
    
    try {
      let adjustedStartDate = state.startDate;
      let adjustedEndDate = state.endDate;
      
      if (state.startDate && state.endDate && state.startDate === state.endDate) {
        adjustedEndDate = `${state.endDate}T23:59:59.999+07:00`;
      }
      
      const response = await fetch('/api/ingest/fetch-emails-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: adjustedStartDate || undefined,
          endDate: adjustedEndDate || undefined
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch emails')
      }
      
      const data = await response.json()
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        previewEmails: data.emails,
        showEmailSelection: true,
        log: `✅ พบอีเมล ${data.emails.length} ฉบับ\n` +
            `📎 มีไฟล์แนบ ${data.emails.filter(email => email.attachmentCount > 0).length} ฉบับ\n` +
            `📋 กรุณาเลือกอีเมลที่ต้องการบันทึก\n`
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: { message: err.message, code: 'FETCH_ERROR' },
        log: `❌ เกิดข้อผิดพลาด: ${err.message}\n`
      }))
    }
  }, [state.startDate, state.endDate])

  const saveSelectedEmails = useCallback(async (selectedEmails) => {
    setState(prev => ({ ...prev, isLoading: true, log: 'กำลังบันทึกอีเมลที่เลือก...\n' }))
    
    try {
      const response = await fetch('/api/ingest/save-selected-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedEmails })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save emails')
      }
      
      const data = await response.json()
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        showEmailSelection: false,
        // Keep previewEmails for AI analyzer
        log: `${prev.log}${data.message}\n` +
            `✅ บันทึกอีเมล ${data.saved || 0} ฉบับเสร็จแล้ว\n` +
            `📎 บันทึกไฟล์แนบ ${data.attachmentStats?.saved || 0} ไฟล์\n`
      }))
      
      // Removed auto-reload to keep previewEmails for AI analyzer
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: { message: err.message, code: 'SAVE_ERROR' },
        log: `${prev.log}❌ เกิดข้อผิดพลาด: ${err.message}\n`
      }))
    }
  }, [])

  return {
    ...state,
    setStartDate,
    setEndDate,
    fetchEmailsPreview,
    saveSelectedEmails,
    clearError,
    hideEmailSelectionModal,
    emailProgress: state.emailProgress
  }
}
