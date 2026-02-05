import { useState, useEffect } from 'react'

export default function EmailHistory() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    fetchEmails()
  }, [])

  const fetchEmails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/ingest/emails')
      if (!response.ok) throw new Error('Failed to fetch emails')
      
      const data = await response.json()
      setEmails(data.emails || [])
    } catch (err) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const filteredEmails = emails.filter(email => {
    const matchesSearch = searchTerm === '' || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.fromEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.bodyText.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesDate = filterDate === '' || 
      new Date(email.receivedAt).toISOString().split('T')[0] === filterDate
    
    return matchesSearch && matchesDate
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p>กำลังโหลดข้อมูลอีเมล...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">📧 อีเมลที่ถูกบันทึกแล้ว</h1>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition-colors"
          >
            📥 ดึงอีเมลใหม่
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <div className="text-2xl font-bold text-red-500">{emails.length}</div>
            <div className="text-gray-400">อีเมลทั้งหมด</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <div className="text-2xl font-bold text-red-500">
              {emails.reduce((sum, email) => sum + email.attachments.length, 0)}
            </div>
            <div className="text-gray-400">ไฟล์แนบทั้งหมด</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <div className="text-2xl font-bold text-red-500">
              {emails.reduce((sum, email) => 
                sum + email.attachments.filter(att => att.extractedText).length, 0
              )}
            </div>
            <div className="text-gray-400">OCR ที่เสร็จแล้ว</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
            <div className="text-2xl font-bold text-red-500">{filteredEmails.length}</div>
            <div className="text-gray-400">ผลการค้นหา</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">ค้นหา</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาหัวข้อ, ผู้ส่ง, หรือเนื้อหา..."
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">วันที่</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-700 rounded focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="space-y-4">
          {filteredEmails.length === 0 ? (
            <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 text-center">
              <div className="text-gray-400">
                {searchTerm || filterDate ? 'ไม่พบอีเมลที่ตรงกับเงื่อนไข' : 'ยังไม่มีอีเมลที่บันทึก'}
              </div>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <div
                key={email.id}
                className="bg-gray-900 p-4 rounded-lg border border-gray-800 hover:border-red-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-red-500">{email.subject}</div>
                    <div className="text-sm text-gray-400">{email.fromEmail}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(email.receivedAt)}
                  </div>
                </div>
                <div className="text-sm text-gray-300 mb-2 line-clamp-2">
                  {email.bodyText}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>📎 {email.attachments.length} ไฟล์แนบ</span>
                  <span>🧠 {email.attachments.filter(att => att.extractedText).length} OCR</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
