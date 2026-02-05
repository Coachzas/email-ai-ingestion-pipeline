import React, { useCallback, useEffect, useMemo, useState } from 'react'

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

export default function ReviewQueue({ onOpenEmail }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [hasAttachments, setHasAttachments] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('limit', '50')

    if (q && q.trim().length > 0) params.set('q', q.trim())
    if (hasAttachments !== '') params.set('hasAttachments', hasAttachments)
    if (ocrStatus !== '') params.set('ocrStatus', ocrStatus)

    return params.toString()
  }, [q, hasAttachments, ocrStatus])

  const fetchItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/review/emails?${queryString}`)
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

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

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
    <section className="review-section">
      <div className="review-header">
        <div>
          <h2>👥 Review Queue</h2>
          <p>รายการอีเมลที่บันทึกแล้วสำหรับ HR Review</p>
        </div>
        <button type="button" className="secondary-button" onClick={fetchItems} disabled={isLoading}>
          🔄 รีเฟรช
        </button>
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
            OCR
            <select value={ocrStatus} onChange={(e) => setOcrStatus(e.target.value)}>
              <option value="">ทั้งหมด</option>
              <option value="done">done</option>
              <option value="partial">partial</option>
              <option value="pending">pending</option>
              <option value="none">none</option>
            </select>
          </label>
        </div>
      </div>

      {error && <div className="error-message" role="alert">❌ {error.message}</div>}

      <div className="review-table-wrapper">
        <table className="review-table">
          <thead>
            <tr>
              <th>วันที่รับ</th>
              <th>From</th>
              <th>Subject</th>
              <th>ไฟล์แนบ</th>
              <th>OCR</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="review-empty">กำลังโหลด...</td>
              </tr>
            )}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="review-empty">ยังไม่มีข้อมูล</td>
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
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
