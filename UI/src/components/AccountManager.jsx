import React, { useState, useEffect } from 'react'

export default function AccountManager() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [testingConnection, setTestingConnection] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '993',
    secure: true,
    username: '',
    password: ''
  })

  const fetchAccounts = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/accounts')
      if (!response.ok) throw new Error('Failed to fetch accounts')
      
      const data = await response.json()
      setAccounts(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSelectedAccount = async () => {
    try {
      const response = await fetch('/api/accounts/selected')
      if (!response.ok) throw new Error('Failed to fetch selected account')
      
      const data = await response.json()
      setSelectedAccount(data)
    } catch (err) {
      console.error('Error fetching selected account:', err)
    }
  }

  const selectAccount = async (accountId) => {
    try {
      const response = await fetch('/api/accounts/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accountId })
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to select account')
      }
      
      const updatedAccount = await response.json()
      setSelectedAccount(updatedAccount)
      await fetchAccounts() // Refresh accounts to update selection status
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('accountChanged', { 
        detail: updatedAccount 
      }))
      
      alert('✅ เปลี่ยนบัญชีสำเร็จ')
    } catch (err) {
      setError(err.message)
    }
  }

  const testConnection = async (accountData = null) => {
    setTestingConnection(true)
    setError(null)
    
    try {
      const testData = accountData || formData
      const response = await fetch('/api/accounts/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Connection test failed')
      }
      
      alert('✅ การเชื่อมต่อสำเร็จ!')
      return true
    } catch (err) {
      setError('❌ ทดสอบการเชื่อมต่อล้มเหลว: ' + err.message)
      return false
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    try {
      const url = editingAccount 
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts'
      
      const method = editingAccount ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save account')
      }
      
      await fetchAccounts()
      resetForm()
      alert(editingAccount ? '✅ อัพเดตบัญชีสำเร็จ' : '✅ เพิ่มบัญชีสำเร็จ')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setFormData({
      name: account.name,
      host: account.host,
      port: account.port.toString(),
      secure: account.secure,
      username: account.username,
      password: '' // Don't populate password for security
    })
    setShowForm(true)
  }

  const handleDelete = async (accountId) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบบัญชีนี้?')) return
    
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to delete account')
      }
      
      await fetchAccounts()
      alert('✅ ลบบัญชีสำเร็จ')
    } catch (err) {
      setError(err.message)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '993',
      secure: true,
      username: '',
      password: ''
    })
    setEditingAccount(null)
    setShowForm(false)
  }

  const getStatusBadge = (status) => {
    const badges = {
      ACTIVE: { text: 'ใช้งาน', class: 'badge-active' },
      INACTIVE: { text: 'ไม่ใช้งาน', class: 'badge-inactive' },
      ERROR: { text: 'ผิดพลาด', class: 'badge-error' }
    }
    
    const badge = badges[status] || badges.INACTIVE
    return <span className={`badge ${badge.class}`}>{badge.text}</span>
  }

  useEffect(() => {
    fetchAccounts()
    fetchSelectedAccount()
  }, [])

  return (
    <div className="account-manager">
      <div className="account-header">
        <div>
          <h2>🔧 จัดการบัญชีอีเมล</h2>
          <p>ตั้งค่าบัญชีอีเมลสำหรับดึงข้อมูล</p>
          {selectedAccount && (
            <div className="selected-account">
              <span className="selected-label">📧 บัญชีที่ใช้งานอยู่:</span>
              <span className="selected-name">{selectedAccount.name}</span>
              <span className="selected-email">({selectedAccount.username})</span>
            </div>
          )}
        </div>
        <button 
          className="primary-button" 
          onClick={() => setShowForm(true)}
          disabled={isLoading}
        >
          ➕ เพิ่มบัญชีใหม่
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="account-form-overlay">
          <div className="account-form">
            <h3>{editingAccount ? '✏️ แก้ไขบัญชี' : '➕ เพิ่มบัญชีใหม่'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>ชื่อบัญชี</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="เช่น Gmail งาน"
                  required
                />
              </div>

              <div className="form-group">
                <label>เซิร์ฟเวอร์ (Host)</label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({...formData, host: e.target.value})}
                  placeholder="เช่น imap.zoho.com"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>พอร์ต</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({...formData, port: e.target.value})}
                    min="1"
                    max="65535"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.secure}
                      onChange={(e) => setFormData({...formData, secure: e.target.checked})}
                    />
                    ใช้ SSL/TLS
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>ชื่อผู้ใช้</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>App Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder={editingAccount ? 'ปล่อยว่างไว้หากไม่เปลี่ยน' : 'กรอกรหัสผ่าน'}
                  required={!editingAccount}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => testConnection()}
                  disabled={testingConnection}
                >
                  {testingConnection ? '⏳ กำลังทดสอบ...' : '🔗 ทดสอบการเชื่อมต่อ'}
                </button>
                
                <div className="form-actions-right">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetForm}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                  >
                    {editingAccount ? '💾 อัพเดต' : '💾 เพิ่มบัญชี'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="account-list">
        {isLoading ? (
          <div className="loading">กำลังโหลด...</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <p>ยังไม่มีบัญชีอีเมล</p>
            <p>คลิก "เพิ่มบัญชีใหม่" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="account-grid">
            {accounts.map((account) => (
              <div key={account.id} className="account-card">
                <div className="account-header">
                  <h4>{account.name}</h4>
                  {getStatusBadge(account.status)}
                </div>
                
                <div className="account-details">
                  <p><strong>เซิร์ฟเวอร์:</strong> {account.host}:{account.port}</p>
                  <p><strong>ผู้ใช้:</strong> {account.username}</p>
                  <p><strong>SSL/TLS:</strong> {account.secure ? 'ใช้' : 'ไม่ใช้'}</p>
                  <p><strong>อีเมล:</strong> {account._count.emails} ฉบับ</p>
                  <p><strong>สร้าง:</strong> {new Date(account.createdAt).toLocaleDateString('th-TH')}</p>
                </div>
                
                <div className="account-actions">
                  {account.status === 'ACTIVE' && (
                    <button
                      className={`select-button small ${selectedAccount?.id === account.id ? 'selected' : ''}`}
                      onClick={() => selectAccount(account.id)}
                      disabled={selectedAccount?.id === account.id}
                    >
                      {selectedAccount?.id === account.id ? '✅ กำลังใช้งาน' : '📧 เลือกใช้งาน'}
                    </button>
                  )}
                  <button
                    className="secondary-button small"
                    onClick={() => handleEdit(account)}
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    className="danger-button small"
                    onClick={() => handleDelete(account.id)}
                    disabled={account._count.emails > 0}
                    title={account._count.emails > 0 ? 'ไม่สามารถลบบัญชีที่มีอีเมล' : 'ลบบัญชี'}
                  >
                    🗑️ ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .account-manager {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .account-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .account-header h2 {
          margin: 0;
          color: #333;
        }

        .account-header p {
          margin: 5px 0 0 0;
          color: #666;
        }

        .selected-account {
          margin-top: 10px;
          padding: 8px 12px;
          background: #e7f3ff;
          border: 1px solid #b3d9ff;
          border-radius: 6px;
          font-size: 14px;
        }

        .selected-label {
          font-weight: 600;
          color: #0066cc;
        }

        .selected-name {
          font-weight: 500;
          color: #333;
          margin-left: 5px;
        }

        .selected-email {
          color: #666;
          margin-left: 5px;
        }

        .account-form-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .account-form {
          background: white;
          padding: 30px;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .account-form h3 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-row {
          display: flex;
          gap: 15px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }

        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group input[type="number"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group input[type="checkbox"] {
          margin-right: 8px;
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .form-actions-right {
          display: flex;
          gap: 10px;
        }

        .account-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .account-card {
          background: white;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .account-card .account-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .account-card .account-header h4 {
          margin: 0;
          color: #333;
        }

        .account-details {
          margin-bottom: 15px;
        }

        .account-details p {
          margin: 5px 0;
          font-size: 14px;
          color: #666;
        }

        .account-actions {
          display: flex;
          gap: 10px;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-active {
          background: #d4edda;
          color: #155724;
        }

        .badge-inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .badge-error {
          background: #fff3cd;
          color: #856404;
        }

        .loading, .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .primary-button, .secondary-button, .danger-button, .select-button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
        }

        .primary-button {
          background: #007bff;
          color: white;
        }

        .primary-button:hover {
          background: #0056b3;
        }

        .secondary-button {
          background: #6c757d;
          color: white;
        }

        .secondary-button:hover {
          background: #545b62;
        }

        .danger-button {
          background: #dc3545;
          color: white;
        }

        .danger-button:hover {
          background: #c82333;
        }

        .select-button {
          background: #28a745;
          color: white;
        }

        .select-button:hover {
          background: #218838;
        }

        .select-button.selected {
          background: #17a2b8;
          cursor: default;
        }

        .select-button.selected:hover {
          background: #17a2b8;
        }

        .small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
