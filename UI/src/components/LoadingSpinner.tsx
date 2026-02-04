import React from 'react'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  message = 'กำลังโหลด...' 
}) => {
  const sizeStyles = {
    small: { width: '16px', height: '16px' },
    medium: { width: '24px', height: '24px' },
    large: { width: '32px', height: '32px' }
  }

  const spinnerStyle: React.CSSProperties = {
    display: 'inline-block',
    border: '2px solid #f3f3f3',
    borderTop: '2px solid #007bff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...sizeStyles[size]
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      justifyContent: 'center'
    }}>
      <div style={spinnerStyle} />
      {message && <span style={{ fontSize: '14px', color: '#666' }}>{message}</span>}
    </div>
  )
}

export default LoadingSpinner
