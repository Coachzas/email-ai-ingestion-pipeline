import { useState, useCallback } from 'react'

export function useAiAnalyzer() {
  const [showAiAnalyzer, setShowAiAnalyzer] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({
    isProcessing: false,
    progress: 0,
    currentEmail: '',
    totalEmails: 0,
    processed: 0,
    errors: 0,
    startTime: null
  })
  const [analysisResults, setAnalysisResults] = useState(null)
  const [showResults, setShowResults] = useState(false)

  const openAiAnalyzer = useCallback(() => {
    console.log('openAiAnalyzer called - setting showAiAnalyzer to true');
    setShowAiAnalyzer(true)
    console.log('showAiAnalyzer set to true');
  }, [])

  const closeAiAnalyzer = useCallback(() => {
    setShowAiAnalyzer(false)
  }, [])

  const startAnalysis = useCallback(async (criteriaFile, selectedEmails, options) => {
    setAnalysisProgress({
      isProcessing: true,
      progress: 0,
      currentEmail: 'กำลังเริ่มต้น...',
      totalEmails: selectedEmails.length,
      processed: 0,
      errors: 0,
      startTime: Date.now()
    })

    try {
      // TODO: Implement actual AI analysis API call
      console.log('Starting AI analysis:', {
        criteriaFile,
        selectedEmails,
        options
      })

      // Mock progress simulation
      for (let i = 0; i < selectedEmails.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate processing
        
        setAnalysisProgress(prev => ({
          ...prev,
          processed: i + 1,
          progress: ((i + 1) / selectedEmails.length) * 100,
          currentEmail: `กำลังวิเคราะห์อีเมลที่ ${i + 1}`
        }))
      }

      // Mock results
      const mockResults = selectedEmails.map((emailId, index) => ({
        id: emailId,
        name: `ผู้สมัคร ${index + 1}`,
        position: 'Software Developer',
        email: `candidate${index + 1}@example.com`,
        phone: `080-123-456${index}`,
        score: Math.floor(Math.random() * 40) + 60, // 60-100
        status: ['ผ่าน', 'พิจารณา', 'ไม่ผ่าน'][Math.floor(Math.random() * 3)],
        skills: [
          { name: 'JavaScript', level: 'Advanced', years: 3 },
          { name: 'React', level: 'Intermediate', years: 2 },
          { name: 'Node.js', level: 'Advanced', years: 2 }
        ],
        criteriaMatches: [
          { criteria: 'JavaScript', percentage: 85 },
          { criteria: 'React', percentage: 70 },
          { criteria: 'Database', percentage: 60 }
        ],
        originalEmail: `Email content for ${emailId}...`
      }))

      setAnalysisResults(mockResults)
      setShowResults(true)
      closeAiAnalyzer()

    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setAnalysisProgress(prev => ({
        ...prev,
        isProcessing: false,
        currentEmail: '✅ เสร็จสิ้น'
      }))
    }
  }, [closeAiAnalyzer])

  const closeResults = useCallback(() => {
    setShowResults(false)
    setAnalysisResults(null)
  }, [])

  return {
    showAiAnalyzer,
    openAiAnalyzer,
    closeAiAnalyzer,
    analysisProgress,
    startAnalysis,
    analysisResults,
    showResults,
    closeResults
  }
}
