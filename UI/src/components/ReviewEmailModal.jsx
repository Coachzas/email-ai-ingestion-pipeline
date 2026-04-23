import React, { useEffect, useState } from 'react'
import LoadingSpinner from './LoadingSpinner.jsx'
import { formatDate } from '../utils'

export default function ReviewEmailModal({ email, onClose }) {
  console.log('ReviewEmailModal rendered with email:', email);
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailDetail, setEmailDetail] = useState(null)

  const handleDownload = async (attachmentId, fileName) => {
    try {
      const response = await fetch(`/api/review/attachments/${attachmentId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file: ' + error.message);
    }
  }

  useEffect(() => {
    if (!email) return

    let isMounted = true

    const run = async () => {
      setIsLoading(true)
      setError(null)
      setEmailDetail(null)

      try {
        const response = await fetch(`/api/review/emails/${email.id}`)
        if (!response.ok) throw new Error('Failed to fetch email detail')

        const data = await response.json()
        if (!isMounted) return

        setEmailDetail(data.email)
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
  }, [email?.id])


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

          {!isLoading && !error && emailDetail && (
            <div className="review-detail-grid">
              <div className="review-panel">
                <h4>📧 อีเมล</h4>
                <div className="review-kv">
                  <div>
                    <strong>From</strong>
                    <div className="review-kv-value">{emailDetail.fromEmail}</div>
                  </div>
                  <div>
                    <strong>Subject</strong>
                    <div className="review-kv-value">{emailDetail.subject || '(no subject)'}</div>
                  </div>
                  <div>
                    <strong>Received</strong>
                    <div className="review-kv-value">{formatDate(emailDetail.receivedAt)}</div>
                  </div>
                  <div>
                    <strong>UID</strong>
                    <div className="review-kv-value">{emailDetail.imapUid}</div>
                  </div>
                </div>

                <div className="review-text-block">
                  <strong>Body</strong>
                  <pre className="review-pre">{emailDetail.bodyText || ''}</pre>
                </div>
              </div>

              <div className="review-panel">
                <h4>📎 ไฟล์แนบ</h4>

                {(!emailDetail.attachments || emailDetail.attachments.length === 0) && (
                  <div className="review-empty">ไม่มีไฟล์แนบ</div>
                )}

                {console.log('Email attachments:', emailDetail.attachments)}
                {emailDetail.attachments && emailDetail.attachments.length > 0 && (
                  <div className="attachment-list">
                    {emailDetail.attachments.map((att) => (
                      <div key={att.id} className="attachment-item">
                        <div className="attachment-top">
                          <div className="attachment-name">
                            {(() => {
                              console.log('Attachment:', { id: att.id, fileName: att.fileName, originalFileName: att.originalFileName });
                              return att.originalFileName || att.fileName;
                            })()}
                          </div>
                          <div className="attachment-actions">
                            <button
                              className="attachment-download"
                              onClick={() => handleDownload(att.id, att.originalFileName || att.fileName || 'download')}
                            >
                              ⬇️ Download
                            </button>
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
