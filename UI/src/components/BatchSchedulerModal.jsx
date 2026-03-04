import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Save, X, Settings } from 'lucide-react';

const BatchSchedulerModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    batchSize: 100,
    scheduleType: 'daily', // 'daily', 'hourly', 'custom'
    customTime: '02:00', // for custom schedule
    customHour: 2,
    customMinute: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const getScheduleDescription = () => {
    switch (formData.scheduleType) {
      case 'daily':
        return 'ทุกวันเวลา 02:00 น.';
      case 'hourly':
        return 'ทุกชั่วโมง';
      case 'custom':
        return `ทุกวันเวลา ${String(formData.customHour || 0).padStart(2, '0')}:${String(formData.customMinute || 0).padStart(2, '0')}`;
      default:
        return '';
    }
  };

  const nextRunAt = useMemo(() => {
    const next = new Date(now);
    const hour = formData.customHour ?? 0;
    const minute = formData.customMinute ?? 0;

    if (formData.scheduleType === 'hourly') {
      next.setSeconds(0, 0);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      return next;
    }

    if (formData.scheduleType === 'daily') {
      next.setHours(2, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }

    if (formData.scheduleType === 'custom') {
      next.setHours(hour, minute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }

    return null;
  }, [formData.customHour, formData.customMinute, formData.scheduleType, now]);

  const countdownText = useMemo(() => {
    if (!nextRunAt) return '';
    const diffMs = nextRunAt.getTime() - now.getTime();
    if (diffMs <= 0) return 'กำลังเริ่มทำงาน...';

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days) parts.push(`${days} วัน`);
    if (hours || days) parts.push(`${String(hours).padStart(2, '0')} ชม.`);
    parts.push(`${String(minutes).padStart(2, '0')} นาที`);
    parts.push(`${String(seconds).padStart(2, '0')} วิ`);
    return parts.join(' ');
  }, [nextRunAt, now]);

  const formatThaiTime = (date) => {
    try {
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch {
      return date.toLocaleString('th-TH');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '672px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        transform: 'scale(1)',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(to right, #eff6ff, #eef2ff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              backgroundColor: '#2563eb',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
              <Settings style={{ width: '1.5rem', height: '1.5rem', color: '#ffffff' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                ตั้งค่า Batch Scheduler
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                กำหนดการดึงอีเมลอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <X style={{ width: '1.5rem', height: '1.5rem', color: '#6b7280' }} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto'
        }}>
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(to right, #f8fafc, #eef2ff)'
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '8px',
                  backgroundColor: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock style={{ width: '1.25rem', height: '1.25rem', color: '#ffffff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>เวลาปัจจุบัน</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginTop: '0.25rem' }}>
                    {formatThaiTime(now)}
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                      flex: 1,
                      minWidth: '14rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>จะทำงานครั้งถัดไป</div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', color: '#2563eb', marginTop: '0.25rem' }}>
                        {nextRunAt ? formatThaiTime(nextRunAt) : '-'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {countdownText ? `อีก ${countdownText}` : ''}
                      </div>
                    </div>

                    <div style={{
                      width: '14rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>รูปแบบการทำงาน</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', marginTop: '0.25rem' }}>
                        {getScheduleDescription()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                🏷️ ชื่อ Scheduler
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                placeholder="เช่น Monthly Archive, Hourly Sync"
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                ตั้งชื่อเพื่อแยกแยะ scheduler ต่างๆ
              </p>
            </div>

          {/* Batch Size */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                📦 Batch Size (อีเมลต่อรอบ)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={formData.batchSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10;
                    setFormData({ ...formData, batchSize: Math.min(2000, Math.max(10, value)) });
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    color: '#374151',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
                <div style={{ width: '5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2563eb' }}>
                    {formData.batchSize}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>อีเมล</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, batchSize: Math.min(2000, formData.batchSize + 50) })}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, batchSize: Math.min(2000, formData.batchSize + 100) })}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, batchSize: Math.min(2000, formData.batchSize + 500) })}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, batchSize: Math.min(2000, formData.batchSize + 1000) })}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                >
                  +1000
                </button>
              </div>
            </div>

          {/* Schedule Type */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                ⏰ กำหนดเวลา
              </label>
              <select
                value={formData.scheduleType}
                onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="daily">ทุกวัน (Daily)</option>
                <option value="hourly">ทุกชั่วโมง (Hourly)</option>
                <option value="custom">กำหนดเอง (Custom)</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {getScheduleDescription()}
              </p>
            </div>

            {/* Custom Time */}
            {formData.scheduleType === 'custom' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  🕐 เวลาทำงาน (ชั่วโมง:นาที)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    required
                    value={formData.customHour || 0}
                    onChange={(e) => setFormData({ ...formData, customHour: parseInt(e.target.value), customTime: `${String(parseInt(e.target.value)).padStart(2, '0')}:${String(formData.customMinute || 0).padStart(2, '0')}` })}
                    style={{
                      width: '80px',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      outline: 'none',
                      textAlign: 'center'
                    }}
                    placeholder="00"
                  />
                  <span style={{ fontSize: '1.2rem', color: '#6b7280' }}>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    required
                    value={formData.customMinute || 0}
                    onChange={(e) => setFormData({ ...formData, customMinute: parseInt(e.target.value), customTime: `${String(formData.customHour || 0).padStart(2, '0')}:${String(parseInt(e.target.value)).padStart(2, '0')}` })}
                    style={{
                      width: '80px',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      outline: 'none',
                      textAlign: 'center'
                    }}
                    placeholder="00"
                  />
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                    (24 ชั่วโมง)
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  💡 ตัวอย่าง: 14:30 = 2:30 บ่าย, 02:00 = 2 โมงเช้า
                </p>
              </div>
            )}

            {/* Date Range */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  📅 วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  📅 วันที่สิ้นสุด (ถ้ามี)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  placeholder="ไม่จำกัด"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

          {/* Preview */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontWeight: '600',
                color: '#1e3a8a',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Calendar style={{ width: '1rem', height: '1rem' }} />
                สรุปการตั้งค่า
              </h3>
              <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                <div><strong>ชื่อ:</strong> {formData.name || 'ยังไม่ระบุ'}</div>
                <div><strong>Batch Size:</strong> {formData.batchSize} อีเมล/รอบ</div>
                <div><strong>กำหนดเวลา:</strong> {getScheduleDescription()}</div>
                <div><strong>ช่วงวันที่:</strong> {formData.startDate} {formData.endDate ? `ถึง ${formData.endDate}` : 'ไม่จำกัด'}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
              >
                <Save style={{ width: '1rem', height: '1rem' }} />
                บันทึก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BatchSchedulerModal;
