import { useState, useEffect, useCallback } from 'react'

export function useOcrProgress() {
  const [progress, setProgress] = useState({
    isProcessing: false,
    currentFile: '',
    totalFiles: 0,
    processed: 0,
    errors: 0,
    startTime: null
  })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)

  let eventSource = null

  const connect = useCallback(() => {
    if (eventSource) {
      eventSource.close()
    }

    try {
      eventSource = new EventSource('/api/ocr-progress/progress')
      
      eventSource.onopen = () => {
        setIsConnected(true)
        setError(null)
        console.log('✅ Connected to OCR progress stream')
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setProgress(prev => ({
            ...prev,
            ...data
          }))
        } catch (err) {
          console.error('❌ Failed to parse progress data:', err)
        }
      }

      eventSource.onerror = (err) => {
        console.error('❌ SSE connection error:', err)
        setIsConnected(false)
        setError('Connection lost')
        
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (eventSource?.readyState === EventSource.CLOSED) {
            connect()
          }
        }, 3000)
      }

    } catch (err) {
      console.error('❌ Failed to connect to OCR progress:', err)
      setError('Failed to connect')
      setIsConnected(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      setIsConnected(false)
    }
  }, [])

  const startOcr = useCallback(async () => {
    try {
      const response = await fetch('/api/ocr-progress/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to start OCR')
      }
      
      const result = await response.json()
      return result
      
    } catch (err) {
      console.error('❌ Failed to start OCR:', err)
      setError(err.message)
      throw err
    }
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    progress,
    isConnected,
    error,
    startOcr,
    disconnect,
    reconnect: connect
  }
}
