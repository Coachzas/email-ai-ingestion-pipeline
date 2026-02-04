import { useState, useCallback } from 'react'
import { EmailData, FetchEmailsRequest, AppError, Email, EmailSummary } from '../types'

interface UseEmailPipelineState {
  startDate: string
  endDate: string
  log: string
  isLoading: boolean
  error: AppError | null
  lastFetchedEmails: Email[] | null
  showEmailDetails: boolean
  searchTerm: string
  emailSummary: EmailSummary | null
  previewEmails: any[] | null
  showEmailSelection: boolean
}

interface UseEmailPipelineActions {
  setStartDate: (date: string) => void
  setEndDate: (date: string) => void
  fetchEmailsPreview: () => Promise<void>
  saveSelectedEmails: (selectedEmails: any[]) => Promise<void>
  clearError: () => void
  showEmailDetailsModal: () => void
  hideEmailDetailsModal: () => void
  hideEmailSelectionModal: () => void
  resetState: () => void
  setSearchTerm: (term: string) => void
  setEmailSummary: (summary: EmailSummary | null) => void
  fetchEmailSummary: () => Promise<void>
}

export const useEmailPipeline = (): UseEmailPipelineState & UseEmailPipelineActions => {
  const [state, setState] = useState<UseEmailPipelineState>({
    startDate: '',
    endDate: '',
    log: 'รอคำสั่ง...',
    isLoading: false,
    error: null,
    lastFetchedEmails: null,
    showEmailDetails: false,
    searchTerm: '',
    emailSummary: null,
    previewEmails: null,
    showEmailSelection: false
  })

  const setStartDate = useCallback((date: string) => {
    setState(prev => ({ ...prev, startDate: date }))
  }, [])

  const setEndDate = useCallback((date: string) => {
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

  const setSearchTerm = useCallback((term: string) => {
    setState(prev => ({ ...prev, searchTerm: term }))
  }, [])

  const setEmailSummary = useCallback((summary: EmailSummary | null) => {
    setState(prev => ({ ...prev, emailSummary: summary }))
  }, [])

  const fetchEmailSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/ingest/email-summary')
      const data = await response.json()
      
      if (data.status === 'success') {
        setEmailSummary(data.summary)
      } else {
        console.error('Failed to fetch email summary:', data.message)
      }
    } catch (err: any) {
      console.error('Error fetching email summary:', err)
    }
  }, [])

  const fetchEmailsPreview = useCallback(async () => {
    if (state.isLoading) return
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null, 
      log: '🔍 กำลังดึงอีเมลตัวอย่าง...'
    }))

    try {
      const response = await fetch('/api/ingest/fetch-emails-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: state.startDate,
          endDate: state.endDate,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        setState(prev => ({ 
          ...prev, 
          log: `✅ ดึงอีเมลตัวอย่าง ${data.count} ฉบับเสร็จแล้ว\n\nเลือกอีเมลที่ต้องการบันทึก:`,
          previewEmails: data.emails,
          showEmailSelection: true
        }))
      } else {
        throw new Error(data.message || 'Failed to fetch emails preview')
      }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: { message: err.message || 'เกิดข้อผิดพลาด' }, 
        log: `❌ Error: ${err.message}` 
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.startDate, state.endDate, state.isLoading])

  const saveSelectedEmails = useCallback(async (selectedEmails: any[]) => {
    if (state.isLoading || selectedEmails.length === 0) return
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      log: `💾 กำลังบันทึก ${selectedEmails.length} ฉบับ...`
    }))

    try {
      const response = await fetch('/api/ingest/save-selected-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedEmails: selectedEmails,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        setState(prev => {
          const logMessage = `${prev.log}\n\n✅ ${data.message}`;
          
          if (data.skippedCount > 0) {
            console.log('📋 Skipped emails:', data.skipped);
          }
          
          return {
            ...prev,
            log: logMessage,
            previewEmails: null,
            showEmailSelection: false
          };
        });
        
        // Refresh summary
        fetchEmailSummary()
      } else {
        throw new Error(data.message || 'Failed to save emails')
      }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: { message: err.message || 'เกิดข้อผิดพลาด' }, 
        log: `❌ Error: ${err.message}` 
      }))
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.isLoading, fetchEmailSummary])

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
      searchTerm: '',
      emailSummary: null,
      previewEmails: null,
      showEmailSelection: false
    })
  }, [])

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
    setSearchTerm,
    setEmailSummary,
    fetchEmailSummary
  }
}
