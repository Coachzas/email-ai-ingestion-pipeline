import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Play, Trash2, RefreshCw, Plus, Settings } from 'lucide-react';

const BatchSchedulerList = ({ isOpen, onClose, onEdit }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSchedulers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/batch-schedulers');
      const result = await response.json();
      
      if (result.success) {
        setSchedulers(result.data);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('ไม่สามารถดึงข้อมูล schedulers ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchedulers();
    }
  }, [isOpen]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`คุณต้องการลบ scheduler "${name}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/batch-schedulers/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (result.success) {
        alert('✅ ลบ scheduler สำเร็จแล้ว');
        fetchSchedulers();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      alert('❌ ไม่สามารถลบ scheduler ได้');
    }
  };

  const handleRunNow = async (id, name) => {
    if (!window.confirm(`คุณต้องการรัน scheduler "${name}" ทันทีใช่หรือไม่?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/batch-schedulers/${id}/run-now`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ รัน scheduler "${name}" สำเร็จแล้ว\n📧 ดึงอีเมล: ${result.data.emailsProcessed} ฉบับ`);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      alert('❌ ไม่สามารถรัน scheduler ได้');
    }
  };

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
      }).format(new Date(date));
    } catch {
      return new Date(date).toLocaleString('th-TH');
    }
  };

  const getScheduleDescription = (scheduler) => {
    switch (scheduler.scheduleType) {
      case 'DAILY':
        return scheduler.customHour !== null && scheduler.customMinute !== null
          ? `ทุกวันเวลา ${String(scheduler.customHour).padStart(2, '0')}:${String(scheduler.customMinute).padStart(2, '0')}`
          : 'ทุกวันเวลา 02:00';
      case 'HOURLY':
        return 'ทุกชั่วโมง';
      case 'CUSTOM':
        return `ทุกวันเวลา ${String(scheduler.customHour || 0).padStart(2, '0')}:${String(scheduler.customMinute || 0).padStart(2, '0')}`;
      default:
        return scheduler.scheduleType;
    }
  };

  const getStatusBadge = (scheduler) => {
    const isActive = scheduler.isActive;
    const hasRuns = scheduler.batchRuns && scheduler.batchRuns.length > 0;
    const lastRun = hasRuns ? scheduler.batchRuns[0] : null;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '600',
          textAlign: 'center',
          backgroundColor: isActive ? '#d4edda' : '#f8d7da',
          color: isActive ? '#155724' : '#721c24'
        }}>
          {isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
        </div>
        {lastRun && (
          <div style={{
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            textAlign: 'center',
            backgroundColor: lastRun.status === 'COMPLETED' ? '#d1ecf1' : 
                           lastRun.status === 'FAILED' ? '#f8d7da' : '#fff3cd',
            color: lastRun.status === 'COMPLETED' ? '#0c5460' : 
                   lastRun.status === 'FAILED' ? '#721c24' : '#856404'
          }}>
            {lastRun.status === 'COMPLETED' ? '✅' : lastRun.status === 'FAILED' ? '❌' : '🔄'} {lastRun.status}
          </div>
        )}
      </div>
    );
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
        maxWidth: '1200px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
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
              <Calendar style={{ width: '1.5rem', height: '1.5rem', color: '#ffffff' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                จัดการ Batch Scheduler
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                ดูและจัดการการตั้งเวลาดึงอีเมลอัตโนมัติ
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={fetchSchedulers}
              disabled={loading}
              style={{
                padding: '0.5rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                opacity: loading ? 0.6 : 1
              }}
            >
              <RefreshCw style={{ width: '1rem', height: '1rem' }} />
            </button>
            <button
              onClick={() => onEdit()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus style={{ width: '1rem', height: '1rem' }} />
              สร้างใหม่
            </button>
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
              <Trash2 style={{ width: '1.5rem', height: '1.5rem', color: '#6b7280' }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ color: '#6b7280' }}>กำลังโหลด...</div>
            </div>
          )}

          {error && (
            <div style={{
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#c00'
            }}>
              ❌ {error}
            </div>
          )}

          {!loading && !error && schedulers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '2px dashed #d1d5db'
            }}>
              <Calendar style={{ width: '3rem', height: '3rem', color: '#9ca3af', margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>ยังไม่มี Batch Scheduler</h3>
              <p style={{ margin: 0, color: '#9ca3af' }}>สร้าง scheduler ใหม่เพื่อเริ่มต้นดึงอีเมลอัตโนมัติ</p>
            </div>
          )}

          {!loading && !error && schedulers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {schedulers.map((scheduler) => (
                <div key={scheduler.id} style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                          {scheduler.name}
                        </h3>
                        {getStatusBadge(scheduler)}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>📦 Batch Size</div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                            {scheduler.batchSize} อีเมล/รอบ
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>⏰ กำหนดการ</div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                            {getScheduleDescription(scheduler)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>📅 ช่วงวันที่</div>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>
                            {new Date(scheduler.startDate).toLocaleDateString('th-TH')}
                            {scheduler.endDate ? ` - ${new Date(scheduler.endDate).toLocaleDateString('th-TH')}` : ' (ไม่จำกัด)'}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>🕐 รันครั้งล่าสุด</div>
                          <div style={{ fontSize: '0.875rem', color: '#111827' }}>
                            {scheduler.lastRunAt ? formatThaiTime(scheduler.lastRunAt) : 'ยังไม่เคยรัน'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>⚡ รันครั้งถัดไป</div>
                          <div style={{ fontSize: '0.875rem', color: '#2563eb', fontWeight: '600' }}>
                            {scheduler.nextRunAt ? formatThaiTime(scheduler.nextRunAt) : '-'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>📊 จำนวนรอบที่รัน</div>
                          <div style={{ fontSize: '0.875rem', color: '#111827' }}>
                            {scheduler.batchRuns?.length || 0} รอบ
                          </div>
                        </div>
                      </div>

                      {scheduler.batchRuns && scheduler.batchRuns.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>📋 รอบล่าสุด:</div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {scheduler.batchRuns.slice(0, 5).map((run) => (
                              <div key={run.id} style={{
                                padding: '4px 8px',
                                backgroundColor: '#f3f4f6',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                border: '1px solid #e5e7eb'
                              }}>
                                <span style={{ fontWeight: '600' }}>#{run.batchNumber}</span>
                                <span style={{ marginLeft: '4px', color: '#6b7280' }}>
                                  {run.status === 'COMPLETED' ? `✅ ${run.emailsProcessed}` : 
                                   run.status === 'FAILED' ? '❌' : '🔄'}
                                </span>
                                <span style={{ marginLeft: '4px', color: '#9ca3af', fontSize: '0.7rem' }}>
                                  {new Date(run.createdAt).toLocaleDateString('th-TH')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1rem' }}>
                      <button
                        onClick={() => handleRunNow(scheduler.id, scheduler.name)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.875rem',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
                      >
                        <Play style={{ width: '0.875rem', height: '0.875rem' }} />
                        รันทันที
                      </button>
                      <button
                        onClick={() => handleDelete(scheduler.id, scheduler.name)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.875rem',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                      >
                        <Trash2 style={{ width: '0.875rem', height: '0.875rem' }} />
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchSchedulerList;
