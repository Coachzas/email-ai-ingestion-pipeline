import React, { useCallback, useEffect, useMemo, useState } from 'react'

import OcrProgressIndicator from './OcrProgressIndicator.jsx'

import { useOcrProgress } from '../hooks/useOcrProgress.js'



const formatDate = (dateString) => {

  try {

    return new Date(dateString).toLocaleString('th-TH', {

      year: 'numeric',

      month: 'short',

      day: 'numeric',

      hour: '2-digit',

      minute: '2-digit'

    })

  } catch {

    return dateString

  }

}



export default function ReviewQueue({ onOpenEmail, onOpenAiAnalyzer, onItemsChange }) {

  const [items, setItems] = useState([])

  const [isLoading, setIsLoading] = useState(false)

  const [error, setError] = useState(null)

  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [ocrLimit, setOcrLimit] = useState(30)

  

  // Use real-time OCR progress

  const { progress, isConnected, startOcr } = useOcrProgress()



  const [q, setQ] = useState('')

  const [hasAttachments, setHasAttachments] = useState('')

  const [ocrStatus, setOcrStatus] = useState('')

  const [fromDate, setFromDate] = useState('')

  const [toDate, setToDate] = useState('')



  const currentAccount = useMemo(() => {

    if (!items.length) return null;

    // All emails are from the same account now, so get account info from first email

    return items[0]?.account || null;

  }, [items]);



  const queryString = useMemo(() => {

    const params = new URLSearchParams()

    params.set('limit', '50')



    if (q && q.trim().length > 0) params.set('q', q.trim())

    if (hasAttachments !== '') params.set('hasAttachments', hasAttachments)

    if (ocrStatus !== '') params.set('ocrStatus', ocrStatus)

    if (fromDate) params.set('fromDate', fromDate)

    if (toDate) {

      // When toDate is the same as fromDate, we need to include the entire day

      // Use local timezone (Thailand UTC+7) instead of UTC

      const adjustedToDate = fromDate === toDate ? `${toDate}T23:59:59.999+07:00` : toDate

      params.set('toDate', adjustedToDate)

    }



    return params.toString()

  }, [q, hasAttachments, ocrStatus, fromDate, toDate, refreshTrigger])



  // Listen for account change events

  useEffect(() => {

    const handleAccountChange = () => {

      console.log('📧 ReviewQueue: Account changed, refreshing...')

      setRefreshTrigger(prev => prev + 1)

    }



    // Create custom event for account changes

    window.addEventListener('accountChanged', handleAccountChange)

    

    return () => {

      window.removeEventListener('accountChanged', handleAccountChange)

    }

  }, [])



  const fetchItems = useCallback(async () => {

    setIsLoading(true)

    setError(null)



    try {

      // Add timestamp to prevent caching

      const cacheBuster = `&_t=${Date.now()}`

      const response = await fetch(`/api/review/emails?${queryString}${cacheBuster}`)

      if (!response.ok) throw new Error('Failed to fetch review emails')



      const data = await response.json()

      setItems(Array.isArray(data.items) ? data.items : [])

    } catch (err) {

      setError(err)

      setItems([])

    } finally {

      setIsLoading(false)

    }

  }, [queryString])



  const handleOcrProcess = async () => {

    setError(null)



    try {

      const result = await startOcr(ocrLimit)

      console.log('✅ OCR started:', result)

      

      // Auto-refresh when OCR completes

      const checkInterval = setInterval(() => {

        if (!progress.isProcessing) {

          clearInterval(checkInterval)

          fetchItems()

        }

      }, 2000)

      

    } catch (err) {

      setError(err)

    }

  }



  const handleDeleteAllEmails = async () => {

    if (!window.confirm('⚠️ ยืนยันการลบอีเมลทั้งหมด?\n\nการกระทำนี้จะลบ:\n• ข้อมูลอีเมลทั้งหมดของบัญชีปัจจุบัน\n• ไฟล์แนบทั้งหมดใน storage\n• ไม่สามารถกู้คืนได้')) {

      return

    }



    setError(null)

    setIsLoading(true)



    try {

      const response = await fetch('/api/review/emails', {

        method: 'DELETE',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify({

          accountId: currentAccount?.id

        })

      })



      console.log('🔍 Response status:', response.status)

      console.log('🔍 Response headers:', response.headers)

      

      if (!response.ok) {

        const responseText = await response.text()

        console.log('🔍 Response text (error):', responseText)

        

        let errorData

        try {

          errorData = JSON.parse(responseText)

        } catch (parseErr) {

          throw new Error(responseText)

        }

        

        throw new Error(errorData.message || 'Failed to delete all emails')

      }



      const responseText = await response.text()

      console.log('🔍 Response text (success):', responseText)

      

      let result

      try {

        result = JSON.parse(responseText)

      } catch (parseErr) {

        console.error('❌ JSON parse error:', parseErr)

        console.error('❌ Response was:', responseText)

        throw new Error('Invalid response from server')

      }

      

      console.log('✅ Deleted all emails:', result)

      

      // Refresh the list

      fetchItems()

      

      // Show success message

      alert(`✅ ลบอีเมลทั้งหมดสำเร็จ!\n\nลบไป ${result.deletedCount} อีเมล\nลบไฟล์แนบ ${result.deletedAttachments} ไฟล์`)

      

    } catch (err) {

      console.error('❌ Delete all emails error:', err)

      setError(`❌ ลบอีเมลทั้งหมดไม่สำเร็จ: ${err.message}`)

      alert(`❌ ลบอีเมลทั้งหมดไม่สำเร็จ:\n${err.message}`)

    } finally {

      setIsLoading(false)

    }

  }



  useEffect(() => {

    fetchItems()

  }, [fetchItems])



  // Send items to parent component when they change

  useEffect(() => {

    if (onItemsChange) {

      onItemsChange(items)

    }

  }, [items, onItemsChange])



  const handleDeleteEmail = async (emailId, event) => {

    event.stopPropagation(); // Prevent row click

    

    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบอีเมลนี้? การลบจะไม่สามารถกู้คืนได้')) {

      return

    }



    try {

      const response = await fetch(`/api/review/emails/${emailId}`, {

        method: 'DELETE'

      })

      

      if (!response.ok) {

        const err = await response.json()

        throw new Error(err.message || 'Failed to delete email')

      }

      

      // Clear cache and fetch fresh data

      await fetchItems()

      alert('✅ ลบอีเมลสำเร็จ')

    } catch (err) {

      setError(err.message)

    }

  }



  const getOcrStatusBadge = (status) => {

    const labels = {

      done: { text: 'เสร็จ', class: 'badge-done' },

      partial: { text: 'บางส่วน', class: 'badge-partial' },

      pending: { text: 'รอดำเนินการ', class: 'badge-pending' },

      none: { text: 'ไม่มี', class: 'badge-none' },

    };

    const { text, class: cls } = labels[status] || labels.none;

    return <span className={`badge ${cls}`}>{text}</span>;

  };



  return (

    <>

      <OcrProgressIndicator

        isProcessing={progress.isProcessing}

        currentFile={progress.currentFile}

        totalFiles={progress.totalFiles}

        processed={progress.processed}

        errors={progress.errors}

      />

      

      <section className="review-section">

      <div className="review-header">

        <div>

          <h2>📝 Email Review Center</h2>

          <p>รายการอีเมลที่บันทึกแล้วสำหรับ HR Review</p>

          {isConnected && (

            <p className="connection-status">🟢 Real-time updates connected</p>

          )}

        </div>

        <div className="review-header-actions">

          <div className="ocr-limit-selector">

            <select 

              id="ocr-limit"

              value={ocrLimit} 

              onChange={(e) => setOcrLimit(Number(e.target.value))}

              disabled={progress.isProcessing}

              className="limit-select"

            >

              <option value={1}>1 ไฟล์ </option>

              <option value={10}>10 ไฟล์ </option>

              <option value={30}>30 ไฟล์ </option>

              <option value={50}>50 ไฟล์ </option>

            </select>

          </div>

          <button 

            type="button" 

            className="primary-button" 

            onClick={handleOcrProcess} 

            disabled={progress.isProcessing || isLoading}

          >

            {progress.isProcessing ? '⏳ กำลังดึงข้อความ...' : `🔍 ดึงข้อความ (${ocrLimit} ไฟล์)`}

          </button>

          <button 

            type="button" 

            className="ai-analyzer-button" 

            onClick={onOpenAiAnalyzer}

            disabled={items.length === 0}

            title="วิเคราะห์ Resume ด้วย AI"

          >

            🤖 AI Resume Analyzer

          </button>

          <button 

            type="button" 

            className="danger-button" 

            onClick={handleDeleteAllEmails} 

            disabled={isLoading || items.length === 0}

            title="ลบอีเมลทั้งหมด"

          >

            🗑️ ลบทั้งหมด

          </button>

          <button type="button" className="secondary-button" onClick={fetchItems} disabled={isLoading}>

            🔄 รีเฟรช

          </button>

        </div>

      </div>



      <div className="review-filters">

        <div className="review-filter">

          <label>

            ค้นหา (From/Subject)

            <input

              type="text"

              value={q}

              onChange={(e) => setQ(e.target.value)}

              placeholder="พิมพ์เพื่อค้นหา..."

            />

          </label>

        </div>



        <div className="review-filter">

          <label>

            วันที่เริ่มต้น

            <input

              type="date"

              value={fromDate}

              onChange={(e) => setFromDate(e.target.value)}

              max={toDate || undefined}

            />

          </label>

        </div>



        <div className="review-filter">

          <label>

            วันที่สิ้นสุด

            <input

              type="date"

              value={toDate}

              onChange={(e) => setToDate(e.target.value)}

              min={fromDate || undefined}

            />

          </label>

        </div>



        <div className="review-filter">

          <label>

            ไฟล์แนบ

            <select value={hasAttachments} onChange={(e) => setHasAttachments(e.target.value)}>

              <option value="">ทั้งหมด</option>

              <option value="true">มีไฟล์แนบ</option>

              <option value="false">ไม่มีไฟล์แนบ</option>

            </select>

          </label>

        </div>



        <div className="review-filter">

          <label>

            ดึงข้อความจากไฟล์

            <select value={ocrStatus} onChange={(e) => setOcrStatus(e.target.value)}>

              <option value="">ทั้งหมด</option>

              <option value="done">เสร็จ</option>

              <option value="partial">บางส่วน</option>

              <option value="pending">รอดำเนินการ</option>

              <option value="none">ไม่มี</option>

            </select>

          </label>

        </div>

      </div>



      {error && <div className="error-message" role="alert">❌ {error.message}</div>}



      <div className="review-table-wrapper">

        {currentAccount && (

          <div className="account-section">

            <div className="account-header-row">

              <h3 className="account-title">

                📧 {currentAccount.name}

              </h3>

              <span className="account-email">({currentAccount.username})</span>

              <span className="account-count">{items.length} ฉบับ</span>

            </div>

            

            <table className="review-table">

              <thead>

                <tr>

                  <th>วันที่รับ</th>

                  <th>From</th>

                  <th>Subject</th>

                  <th>ไฟล์แนบ</th>

                  <th>ดึงข้อความจากไฟล์</th>

                  <th>จัดการ</th>

                </tr>

              </thead>

              <tbody>

                {isLoading && (

                  <tr>

                    <td colSpan={6} className="review-empty">กำลังโหลด...</td>

                  </tr>

                )}



                {!isLoading && items.length === 0 && (

                  <tr>

                    <td colSpan={6} className="review-empty">ไม่มีอีเมลในบัญชีนี้</td>

                  </tr>

                )}



                {!isLoading &&

                  items.map((row) => (

                    <tr

                      key={row.id}

                      className="review-row"

                      onClick={() => onOpenEmail && onOpenEmail(row.id)}

                      role="button"

                      tabIndex={0}

                      onKeyDown={(e) => {

                        if (e.key === 'Enter') onOpenEmail && onOpenEmail(row.id)

                      }}

                    >

                      <td>{formatDate(row.receivedAt)}</td>

                      <td className="review-cell-muted">{row.fromEmail}</td>

                      <td className="review-cell-subject">{row.subject || '(no subject)'}</td>

                      <td>{row.attachmentCount}</td>

                      <td>

                        {getOcrStatusBadge(row.ocrStatus)}

                      </td>

                      <td onClick={(e) => e.stopPropagation()}>

                        <button

                          className="delete-button small"

                          onClick={(e) => handleDeleteEmail(row.id, e)}

                          title="ลบอีเมล"

                        >

                          🗑️ ลบ

                        </button>

                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>

        )}

        

        {!isLoading && !currentAccount && (

          <div className="no-accounts">

            <p>ไม่พบอีเมลในบัญชีที่เลือกใช้งาน</p>

          </div>

        )}

      </div>

      </section>

      

      <style jsx>{`

        .review-section {

          padding: 20px;

        }



        .review-header {

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          margin-bottom: 20px;

        }



        .review-header h2 {

          margin: 0;

          color: #333;

        }



        .review-header p {

          margin: 5px 0 0 0;

          color: #666;

        }



        .review-header-actions {

          display: flex;

          gap: 10px;

        }



        .review-filters {

          display: flex;

          gap: 15px;

          margin-bottom: 20px;

          flex-wrap: wrap;

        }



        .review-filter {

          display: flex;

          flex-direction: column;

          gap: 5px;

        }



        .review-filter label {

          font-size: 14px;

          font-weight: 500;

          color: #333;

        }



        .review-filter input,

        .review-filter select {

          padding: 8px 12px;

          border: 1px solid #ddd;

          border-radius: 4px;

          font-size: 14px;

        }



        .review-table-wrapper {

          overflow-x: auto;

          margin-top: 20px;

        }



        .account-section {

          margin-bottom: 30px;

          border: 1px solid #e1e5e9;

          border-radius: 8px;

          overflow: hidden;

        }



        .account-header-row {

          background: #f8f9fa;

          padding: 12px 16px;

          border-bottom: 1px solid #e1e5e9;

          display: flex;

          align-items: center;

          gap: 12px;

        }



        .account-title {

          margin: 0;

          font-size: 16px;

          font-weight: 600;

          color: #333;

        }



        .account-email {

          color: #666;

          font-size: 14px;

        }



        .account-count {

          background: #007bff;

          color: white;

          padding: 2px 8px;

          border-radius: 12px;

          font-size: 12px;

          font-weight: 500;

          margin-left: auto;

        }



        .no-accounts {

          text-align: center;

          padding: 40px;

          color: #666;

        }



        .review-table {

          width: 100%;

          border-collapse: collapse;

          background: white;

        }



        .review-table th {

          background: #f8f9fa;

          padding: 12px 8px;

          text-align: left;

          font-weight: 600;

          border-bottom: 1px solid #e1e5e9;

          font-size: 14px;

        }



        .review-table td {

          padding: 12px 8px;

          border-bottom: 1px solid #f1f3f4;

          font-size: 14px;

        }



        .review-row {

          cursor: pointer;

          transition: background-color 0.2s;

        }



        .review-row:hover {

          background-color: #f8f9fa;

        }



        .review-cell-muted {

          color: #666;

        }



        .review-cell-subject {

          max-width: 300px;

          overflow: hidden;

          text-overflow: ellipsis;

          white-space: nowrap;

        }



        .review-empty {

          text-align: center;

          padding: 40px;

          color: #666;

          font-style: italic;

        }



        .error-message {

          background: #f8d7da;

          color: #721c24;

          padding: 12px;

          border-radius: 4px;

          margin-bottom: 20px;

        }



        .badge {

          padding: 4px 8px;

          border-radius: 12px;

          font-size: 12px;

          font-weight: 500;

        }



        .badge-done {

          background: #d4edda;

          color: #155724;

        }



        .badge-partial {

          background: #fff3cd;

          color: #856404;

        }



        .badge-pending {

          background: #f8d7da;

          color: #721c24;

        }



        .badge-none {

          background: #e2e3e5;

          color: #6c757d;

        }



        .connection-status {

          color: #28a745;

          font-size: 12px;

          margin: 5px 0 0 0;

        }



        .primary-button, .secondary-button {

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



        .primary-button:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }



        .secondary-button {

          background: #6c757d;

          color: white;

        }



        .secondary-button:hover {

          background: #545b62;

        }



        .secondary-button:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }



        .danger-button {

          background: #dc3545;

          color: white;

        }



        .danger-button:hover {

          background: #c82333;

        }



        .danger-button:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }



        .secondary-button:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }



        .delete-button {

          padding: 6px 12px;

          border: none;

          border-radius: 4px;

          cursor: pointer;

          font-size: 12px;

          text-decoration: none;

          display: inline-block;

          background: #dc3545;

          color: white;

        }



        .delete-button:hover {

          background: #c82333;

        }



        .delete-button.small {

          padding: 4px 8px;

          font-size: 11px;

        }



        .ocr-limit-selector {

          display: flex;

          align-items: center;

          gap: 8px;

        }



        .ocr-limit-selector label {

          font-size: 14px;

          color: #fff;

          font-weight: 500;

        }



        .limit-select {

          padding: 6px 12px;

          border: 1px solid #333;

          border-radius: 4px;

          background: #111;

          color: #fff;

          font-size: 14px;

          cursor: pointer;

          transition: border-color 0.2s;

        }



        .limit-select:hover {

          border-color: #007bff;

        }



        .limit-select:focus {

          outline: none;

          border-color: #007bff;

          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);

        }



        .limit-select:disabled {

          opacity: 0.6;

          cursor: not-allowed;

        }



        .review-header-actions {

          display: flex;

          flex-direction: row;

          align-items: center;

          gap: 12px;

          flex-wrap: wrap;

        }

      `}</style>

    </>

  )

}

