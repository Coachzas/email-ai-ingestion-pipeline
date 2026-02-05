import React, { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner.jsx'

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

export default function ReviewEmailModal({ emailId, onClose }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState(null)

  useEffect(() => {
    if (!emailId) return

    let isMounted = true

    const run = async () => {
      setIsLoading(true)
      setError(null)
      setEmail(null)

      try {
        const response = await fetch(`/api/review/emails/${emailId}`)
        if (!response.ok) throw new Error('Failed to fetch email detail')

        const data = await response.json()
        if (!isMounted) return

        setEmail(data.email)
      } catch (err) {
        if (!isMounted) return
        setError(err)
      } finally {
        if (!isMounted) return
        setIsLoading(false)
      }
    }

    run()

    return () => {
      isMounted = false
    }
  }, [emailId])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h3>👤 Applicant Workspace</h3>
          <button onClick={onClose} className="close-btn" aria-label="ปิด">
            ×
          </button>
        </div>

        <div className="modal-body">
          {isLoading && (
            <div className="modal-loading">
              <LoadingSpinner message="กำลังโหลดรายละเอียด..." />
            </div>
          )}

          {error && <div className="error-message">❌ {error.message}</div>}

          {!isLoading && !error && email && (
            <div className="review-detail-grid">
              <div className="review-panel">
                <h4>📧 อีเมล</h4>
                <div className="review-kv">
                  <div>
                    <strong>From</strong>
                    <div className="review-kv-value">{email.fromEmail}</div>
                  </div>
                  <div>
                    <strong>Subject</strong>
                    <div className="review-kv-value">{email.subject || '(no subject)'}</div>
                  </div>
                  <div>
                    <strong>Received</strong>
                    <div className="review-kv-value">{formatDate(email.receivedAt)}</div>
                  </div>
                  <div>
                    <strong>UID</strong>
                    <div className="review-kv-value">{email.imapUid}</div>
                  </div>
                </div>

                <div className="review-text-block">
                  <strong>Body</strong>
                  <pre className="review-pre">{email.bodyText || ''}</pre>
                </div>
              </div>

              <div className="review-panel">
                <h4>📎 ไฟล์แนบ</h4>

                {(!email.attachments || email.attachments.length === 0) && (
                  <div className="review-empty">ไม่มีไฟล์แนบ</div>
                )}

                {email.attachments && email.attachments.length > 0 && (
                  <div className="attachment-list">
                    {email.attachments.map((att) => (
                      <div key={att.id} className="attachment-item">
                        <div className="attachment-top">
                          <div className="attachment-name">{att.fileName}</div>
                          <div className="attachment-actions">
                            <a
                              className="attachment-download"
                              href={`/api/review/attachments/${att.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ⬇️ Download
                            </a>
                          </div>
                        </div>

                        <div className="attachment-meta">
                          <span>{att.fileType}</span>
                          {typeof att.size === 'number' && <span>{att.size} bytes</span>}
                        </div>

                        <details className="attachment-details" open={false}>
                          <summary>
                            Extracted Text {att.extractedText && typeof att.extractedText === 'string' ? `( ${att.extractedText.length} chars )` : '(0)'}
                          </summary>
                          <pre className="attachment-extracted">
                            {att.extractedText && typeof att.extractedText === 'string' ? att.extractedText : ''}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
