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

      }



      eventSource.onmessage = (event) => {

        try {

          const data = JSON.parse(event.data)

          setProgress(prev => ({

            ...prev,

            ...data

          }))

          

          // ถ้า OCR เสร็จและมี refresh flag

          if (data.refresh && data.completed) {

            console.log('🔄 OCR completed, refreshing page...')

            setTimeout(() => {

              if (typeof window !== 'undefined' && window.location) {

                window.location.reload()

              }

            }, 1000)

          }

          // ถ้า OCR เสร็จ (fallback)

          else if (data.isProcessing === false && prev.isProcessing === true) {

            setTimeout(() => {

              if (typeof window !== 'undefined' && window.location) {

                window.location.reload()

              }

            }, 2000)

          }

        } catch (err) {

          // Silently ignore parsing errors

        }

      }



      eventSource.onerror = (err) => {

        setIsConnected(false)

        setError('Connection lost')

        

        setTimeout(() => {

          if (eventSource?.readyState === EventSource.CLOSED) {

            connect()

          }

        }, 3000)

      }



    } catch (err) {

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



  const startOcr = useCallback(async (limit = 30) => {

    try {

      const response = await fetch('/api/ocr-progress/start', {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({ limit })  // ← ส่ง limit ไปกับ request

      })

      

      if (!response.ok) {

        const error = await response.json()

        throw new Error(error.message || 'Failed to start OCR')

      }

      

      const result = await response.json()

      return result

      

    } catch (err) {

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

