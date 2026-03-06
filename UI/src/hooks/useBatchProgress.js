import { useState, useCallback, useEffect } from 'react'

export const useBatchProgress = () => {
  const initialState = {
    isProcessing: false,
    currentPhase: '', // 'fetching', 'saving', 'ocr', 'completed'
    currentItem: '',
    totalEmails: 0,
    processedEmails: 0,
    totalAttachments: 0,
    processedAttachments: 0,
    errors: 0,
    startTime: null,
    phaseDetails: {
      fetching: { current: '', total: 0 },
      saving: { current: '', total: 0 },
      ocr: { current: '', total: 0 }
    }
  }

  const [state, setState] = useState(initialState)

  // SSE connection for batch progress
  useEffect(() => {
    let eventSource

    const connectBatchProgress = () => {
      eventSource = new EventSource('/api/batch-progress/progress')
      
      eventSource.onmessage = (event) => {
        try {
          const progressData = JSON.parse(event.data)
          setState(prev => ({
            ...prev,
            ...progressData
          }))
        } catch (err) {
          // Silently ignore parsing errors
        }
      }

      eventSource.onerror = (err) => {
        eventSource?.close()
        setTimeout(connectBatchProgress, 3000)
      }
    }

    connectBatchProgress()

    return () => {
      eventSource?.close()
    }
  }, [])

  const resetProgress = useCallback(() => {
    setState(initialState)
  }, [])

  // Calculate overall progress percentage
  const getOverallProgress = useCallback(() => {
    if (!state.isProcessing) return 0
    
    const totalSteps = 3 // fetching, saving, ocr
    let currentStep = 0
    let stepProgress = 0

    switch (state.currentPhase) {
      case 'fetching':
        currentStep = 0
        // แสดง progress จากจำนวนอีเมลที่ดึงมาแล้ว
        const fetchingTotal = state.phaseDetails.fetching.total
        const fetchingCurrent = state.phaseDetails.fetching.current
        if (fetchingTotal > 0 && typeof fetchingCurrent === 'number') {
          stepProgress = (fetchingCurrent / fetchingTotal) * 100
        } else {
          // ถ้า current เป็น string (subject) ให้แสดง progress แบบ indeterminate
          stepProgress = 0
        }
        break
      case 'saving':
        currentStep = 1
        stepProgress = state.totalEmails > 0 
          ? (state.processedEmails / state.totalEmails) * 100 
          : 0
        break
      case 'ocr':
        currentStep = 2
        // ถ้าไม่มีไฟล์แนบ ให้ข้ามไป completed ทันที
        if (state.totalAttachments === 0) {
          return 100
        }
        stepProgress = state.totalAttachments > 0 
          ? (state.processedAttachments / state.totalAttachments) * 100 
          : 0
        break
      case 'completed':
        return 100
      default:
        return 0
    }

    return Math.round(((currentStep * 100) + stepProgress) / totalSteps)
  }, [state])

  // Get phase display text
  const getPhaseText = useCallback(() => {
    switch (state.currentPhase) {
      case 'fetching':
        return 'กำลังดึงอีเมลจากเซิร์ฟเวอร์'
      case 'saving':
        return 'กำลังบันทึกอีเมลลงฐานข้อมูล'
      case 'ocr':
        return 'กำลังประมวลผล OCR'
      case 'completed':
        return 'เสร็จสิ้น'
      default:
        return state.isProcessing ? 'กำลังดำเนินการ' : 'พร้อมทำงาน'
    }
  }, [state.currentPhase, state.isProcessing])

  return {
    ...state,
    resetProgress,
    getOverallProgress,
    getPhaseText
  }
}
