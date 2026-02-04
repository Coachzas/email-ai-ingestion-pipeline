import { useState, useCallback } from 'react'
import { EmailData, FetchEmailsRequest } from '../types'

interface UseEmailPipelineState {
  startDate: string
  endDate: string
  log: string
  isLoading: boolean
  error: string | null
  lastFetchedEmails: any[] | null
  showEmailDetails: boolean
}

interface UseEmailPipelineActions {
  setStartDate: (date: string) => void
  setEndDate: (date: string) => void
  fetchEmails: () => Promise<void>
  clearError: () => void
  showEmailDetailsModal: () => void
  hideEmailDetailsModal: () => void
  resetState: () => void
}

export const useEmailPipeline = (): UseEmailPipelineState & UseEmailPipelineActions => {
  const [state, setState] = useState<UseEmailPipelineState>({
    startDate: '',
    endDate: '',
    log: 'รอคำสั่ง...',
    isLoading: false,
    error: null,
    lastFetchedEmails: null,
    showEmailDetails: false
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

  const resetState = useCallback(() => {
    setState({
      startDate: '',
      endDate: '',
      log: 'รอคำสั่ง...',
      isLoading: false,
      error: null,
      lastFetchedEmails: null,
      showEmailDetails: false
    })
  }, [])

  const fetchEmails = useCallback(async () => {
    if (state.isLoading) return
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null, 
      log: '⏳ กำลังดึงอีเมล...' 
    }))
    
    try {
      const requestBody: FetchEmailsRequest = {
        startDate: state.startDate || null,
        endDate: state.endDate || null
      }

      const res = await fetch('/api/ingest/fetch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`)
      }

      const text = await res.text()
      if (!text) {
        setState(prev => ({ 
          ...prev, 
          log: `Status: ${res.status} ${res.statusText} (empty response)` 
        }))
        return
      }

      try {
        const data: EmailData = JSON.parse(text)
        
        let displayText = '✅ สำเร็จ\n\n'
        displayText += `📊 จำนวนอีเมล: ${data.emailCount || 0}\n\n`
        
        if (data.emails && data.emails.length > 0) {
          displayText += '📧 รายละเอียดอีเมล:\n'
          displayText += JSON.stringify(data.emails, null, 2)
          displayText += '\n\n'
        }
        
        if (data.ocr) {
          displayText += '📎 สถานะ OCR:\n'
          displayText += JSON.stringify({
            total: data.ocr.total,
            processed: data.ocr.processed,
            successful: data.ocr.successful,
            errors: data.ocr.errors,
            results: data.ocr.results
          }, null, 2)
        }
        
        setState(prev => ({ 
          ...prev, 
          log: displayText,
          lastFetchedEmails: data.emails || null
        }))
      } catch (e) {
        setState(prev => ({ 
          ...prev, 
          log: `Status: ${res.status} ${res.statusText}\n\n` + text 
        }))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        log: '❌ Error: ' + errorMessage 
      }))
      console.error('Fetch emails error:', err)
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.startDate, state.endDate, state.isLoading])

  return {
    ...state,
    setStartDate,
    setEndDate,
    fetchEmails,
    clearError,
    showEmailDetailsModal,
    hideEmailDetailsModal,
    resetState
  }
}
