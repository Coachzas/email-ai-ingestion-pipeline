import React, { useState, useEffect } from 'react'

export default function TokenUsage() {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('today')

  // ดึงข้อมูลสถิติ
  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/token-usage/stats?period=${period}`)
      const data = await response.json()
      
      if (data.success) {
        setStats(data.data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ดึงประวัติการใช้งาน
  const fetchHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/token-usage/history?limit=50')
      const data = await response.json()
      
      if (data.success) {
        setHistory(data.data)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ดาวน์โหลด log
  const cleanupLogs = async () => {
    try {
      const response = await fetch('/api/token-usage/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 })
      })
      const data = await response.json()
      
      if (data.success) {
        alert('✅ ลบ log เก่า 30 วันเรียบร้อย')
        fetchHistory()
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchHistory()
  }, [period])

  const formatNumber = (num) => new Intl.NumberFormat('th-TH').format(num)

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>📊 ประวัติการใช้งาน Gemini Token</h2>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc', 
          borderRadius: '4px', 
          marginBottom: '20px' 
        }}>
          ❌ {error}
        </div>
      )}

      {/* ตัวเลือกช่วงเวลา */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px' }}>ช่วงเวลา:</label>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: '4px' }}
        >
          <option value="today">วันนี้</option>
          <option value="week">7 วัน</option>
          <option value="month">30 วัน</option>
        </select>
      </div>

      {/* สถิติ */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '15px', 
          marginBottom: '30px' 
        }}>
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '1px solid #dee2e6' 
          }}>
            <h4 style={{ color: '#111827', marginBottom: '10px' }}>📝 ข้อความทั้งหมด</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0', color: '#111827' }}>
              {formatNumber(stats.totalInputTokens || 0)}
            </p>
            <small style={{ color: '#4b5563', fontWeight: '500' }}>Input Tokens</small>
          </div>
          
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '1px solid #dee2e6' 
          }}>
            <h4 style={{ color: '#111827', marginBottom: '10px' }}>🤖 ข้อความที่สร้าง</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0', color: '#111827' }}>
              {formatNumber(stats.totalOutputTokens || 0)}
            </p>
            <small style={{ color: '#4b5563', fontWeight: '500' }}>Output Tokens</small>
          </div>
          
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '1px solid #dee2e6' 
          }}>
            <h4 style={{ color: '#111827', marginBottom: '10px' }}>📄 ไฟล์ที่ประมวลผล</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0', color: '#111827' }}>
              {formatNumber(stats.filesProcessed || 0)}
            </p>
            <small style={{ color: '#4b5563', fontWeight: '500' }}>Files</small>
          </div>
          
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px', 
            border: '1px solid #dee2e6' 
          }}>
            <h4 style={{ color: '#111827', marginBottom: '10px' }}>💰 ค่าใช้จ่าย</h4>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '5px 0', color: '#111827' }}>
              ${formatNumber((stats.totalCost || 0).toFixed(4))}
            </p>
            <small style={{ color: '#4b5563', fontWeight: '500' }}>USD</small>
          </div>
        </div>
      )}

      {/* ปุ่มจัดการ */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={cleanupLogs}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            marginRight: '10px',
            cursor: 'pointer'
          }}
        >
          🗑️ ลบ log เก่า (30 วัน)
        </button>
        <button 
          onClick={() => window.location.href = '/api/token-usage/report'}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          📄 ดาวน์โหลดรายงาน
        </button>
      </div>

      {/* ประวัติการใช้งานล่าสุด */}
      <div>
        <h3>📋 ประวัติการใช้งานล่าสุด</h3>
        {loading ? (
          <p>⏳ กำลังโหลดข้อมูล...</p>
        ) : (
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #dee2e6', 
            borderRadius: '4px' 
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#111827', fontWeight: '600' }}>เวลา</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#111827', fontWeight: '600' }}>ไฟล์</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#111827', fontWeight: '600' }}>Input</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#111827', fontWeight: '600' }}>Output</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#111827', fontWeight: '600' }}>ค่าใช้จ่าย</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      {new Date(item.timestamp).toLocaleString('th-TH')}
                    </td>
                    <td style={{ padding: '10px' }}>{item.fileName}</td>
                    <td style={{ padding: '10px' }}>{formatNumber(item.inputTokens)}</td>
                    <td style={{ padding: '10px' }}>{formatNumber(item.outputTokens)}</td>
                    <td style={{ padding: '10px' }}>${item.cost?.toFixed(6) || '0.000000'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {history.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                ไม่มีข้อมูลการใช้งานในช่วงเวลานี้
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
