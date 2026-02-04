import React, { ReactNode, Component, ErrorInfo } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ff6b6b', 
          borderRadius: '8px', 
          backgroundColor: '#ffe0e0',
          margin: '20px 0'
        }}>
          <h2 style={{ color: '#d63031', margin: '0 0 10px 0' }}>
            ⚠️ เกิดข้อผิดพลาดในแอปพลิเคชัน
          </h2>
          <p style={{ margin: '0 0 15px 0', color: '#636e72' }}>
            มีบางอย่างผิดปกติในการทำงานของแอปพลิเคชัน กรุณาลองใหม่อีกครั้ง
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              marginBottom: '15px', 
              padding: '10px', 
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                ดูรายละเอียดข้อผิดพลาด (Development Mode)
              </summary>
              <pre style={{ marginTop: '10px', overflow: 'auto' }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          
          <button 
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0984e3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 ลองใหม่
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
