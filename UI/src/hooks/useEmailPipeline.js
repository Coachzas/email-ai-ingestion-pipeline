import { useState, useCallback, useEffect } from 'react'

export const useEmailPipeline = () => {
  const [state, setState] = useState({
    startDate: '',
    endDate: '',
    log: 'รอคำสั่ง...',
    isLoading: false,
    error: null,
    lastFetchedEmails: null,
    showEmailDetails: false,
    emailSummary: null,
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
  })

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
              // Calculate progress percentage
              progress: progressData.totalEmails > 0 
                ? Math.round((progressData.processed / progressData.totalEmails) * 100)
                : 0
            }
          }))
        } catch (err) {
          console.error('Error parsing email progress data:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('Email progress SSE error:', err)
        eventSource?.close()
        // Reconnect after 3 seconds
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

  const showEmailDetailsModal = useCallback(() => {
    setState(prev => ({ ...prev, showEmailDetails: true }))
  }, [])

  const hideEmailDetailsModal = useCallback(() => {
    setState(prev => ({ ...prev, showEmailDetails: false }))
  }, [])

  const hideEmailSelectionModal = useCallback(() => {
    setState(prev => ({ ...prev, showEmailSelection: false, previewEmails: null }))
  }, [])

  const resetState = useCallback(() => {
    setState({
      startDate: '',
      endDate: '',
      log: 'รอคำสั่ง...',
      isLoading: false,
      error: null,
      lastFetchedEmails: null,
      showEmailDetails: false,
      emailSummary: null,
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
    })
  }, [])


  const setEmailSummary = useCallback((summary) => {
    setState(prev => ({ ...prev, emailSummary: summary }))
  }, [])

  const fetchEmailSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/ocr/summary')
      if (!response.ok) throw new Error('Failed to fetch email summary')
      
      const data = await response.json()
      setEmailSummary(data.summary)
    } catch (err) {
      console.error('Error fetching email summary:', err)
    }
  }, [])

  const fetchEmailsPreview = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null, log: 'กำลังเชื่อมต่อ IMAP...\n' }))
    
    try {
      // Adjust dates for proper timezone handling
      let adjustedStartDate = state.startDate;
      let adjustedEndDate = state.endDate;
      
      if (state.startDate && state.endDate && state.startDate === state.endDate) {
        // When same date, add time range to include entire day
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
        lastFetchedEmails: data,
        previewEmails: data.emails,
        showEmailSelection: true,
        log: `✅ พบอีเมล ${data.emails.length} ฉบับ\n` +
            `📎 มีไฟล์แนบ ${data.withAttachments} ฉบับ\n` +
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
      // Debug: ตรวจสอบข้อมูลที่ส่ง
      console.log('🔍 Selected emails to save:', selectedEmails);
      
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
        previewEmails: null,
        log: `${prev.log}${data.message}\n` +
            `✅ บันทึกอีเมล ${data.savedCount || 0} ฉบับเสร็จแล้ว\n` +
            `⏭️ ข้าม ${data.skippedCount || 0} ฉบับที่ซ้ำ\n` +
            `📎 บันทึกไฟล์แนบ ${data.attachmentSavedCount || 0} ไฟล์ (ข้าม ${data.attachmentSkippedCount || 0} ไฟล์)\n`
      }))
      
      // ดึงข้อมูลสรุปใหม่
      await fetchEmailSummary()
      
      // Refresh ReviewQueue page after successful save
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload()
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: { message: err.message, code: 'SAVE_ERROR' },
        log: `${prev.log}❌ เกิดข้อผิดพลาด: ${err.message}\n`
      }))
    }
  }, [fetchEmailSummary])

  return {
    ...state,
    setStartDate,
    setEndDate,
    fetchEmailsPreview,
    saveSelectedEmails,
    clearError,
    showEmailDetailsModal,
    hideEmailDetailsModal,
    hideEmailSelectionModal,
    resetState,
    setEmailSummary,
    fetchEmailSummary,
    emailProgress: state.emailProgress
  }
}
