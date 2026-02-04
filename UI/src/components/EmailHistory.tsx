import { useState, useEffect } from 'react'

interface Email {
  id: string
  imapUid: number
  fromEmail: string
  subject: string
  bodyText: string
  receivedAt: string
  createdAt: string
  attachments: Attachment[]
}

interface Attachment {
  id: string
  fileName: string
  fileType: string
  filePath: string
  extractedText: string | null
  createdAt: string
}

export default function EmailHistory() {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
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
      setError(err instanceof Error ? err.message : 'Unknown error')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️'
    if (fileType.includes('pdf')) return '📄'
    if (fileType.includes('word')) return '📝'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📽️'
    return '📎'
  }

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/ingest/download/${attachment.id}`)
      if (!response.ok) throw new Error('Failed to download file')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to download file: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
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

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <p className="text-xl mb-4">เกิดข้อผิดพลาด</p>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={fetchEmails}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">📧 ประวัติอีเมลที่บันทึก</h1>
        
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
            <div className="text-2xl font-bold text-red-500">
              {filteredEmails.length}
            </div>
            <div className="text-gray-400">ผลการค้นหา</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Email List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">📋 รายการอีเมล</h2>
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
                  onClick={() => setSelectedEmail(email)}
                  className={`bg-gray-900 p-4 rounded-lg border cursor-pointer transition-all hover:border-red-500 ${
                    selectedEmail?.id === email.id ? 'border-red-500' : 'border-gray-800'
                  }`}
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

          {/* Email Detail */}
          <div>
            <h2 className="text-xl font-semibold mb-4">📄 รายละเอียด</h2>
            {selectedEmail ? (
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                <div className="mb-4">
                  <div className="font-semibold text-red-500 text-lg mb-2">
                    {selectedEmail.subject}
                  </div>
                  <div className="text-sm text-gray-400 mb-1">
                    จาก: {selectedEmail.fromEmail}
                  </div>
                  <div className="text-sm text-gray-400 mb-1">
                    วันที่: {formatDate(selectedEmail.receivedAt)}
                  </div>
                  <div className="text-sm text-gray-400 mb-1">
                    UID: {selectedEmail.imapUid}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-semibold mb-2">📝 เนื้อหาอีเมล</h3>
                  <div className="bg-black p-3 rounded border border-gray-700 max-h-40 overflow-y-auto">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                      {selectedEmail.bodyText || '(ไม่มีเนื้อหา)'}
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">📎 ไฟล์แนบ ({selectedEmail.attachments.length})</h3>
                  {selectedEmail.attachments.length === 0 ? (
                    <div className="text-gray-400">(ไม่มีไฟล์แนบ)</div>
                  ) : (
                    <div className="space-y-3">
                      {selectedEmail.attachments.map((attachment) => (
                        <div key={attachment.id} className="bg-black p-3 rounded border border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getFileIcon(attachment.fileType)}</span>
                              <span className="font-medium">{attachment.fileName}</span>
                            </div>
                            <button
                              onClick={() => downloadAttachment(attachment)}
                              className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition-colors"
                            >
                              ดาวน์โหลด
                            </button>
                          </div>
                          <div className="text-xs text-gray-400 mb-1">
                            ประเภท: {attachment.fileType}
                          </div>
                          <div className="text-xs text-gray-400 mb-2">
                            สร้างเมื่อ: {formatDate(attachment.createdAt)}
                          </div>
                          {attachment.extractedText ? (
                            <div>
                              <div className="text-xs font-semibold text-green-500 mb-1">
                                ✅ OCR สำเร็จ
                              </div>
                              <div className="bg-gray-950 p-2 rounded border border-gray-800 max-h-32 overflow-y-auto">
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                  {attachment.extractedText.substring(0, 500)}
                                  {attachment.extractedText.length > 500 ? '...' : ''}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-yellow-500">
                              ⏳ รอการ OCR หรือไม่สามารถ OCR ได้
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 text-center">
                <div className="text-gray-400">เลือกอีเมลเพื่อดูรายละเอียด</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
