import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Play, Trash2, RefreshCw, Plus, Settings, X, Check, Edit } from 'lucide-react';

const BatchSchedulerList = ({ isOpen, onClose, onEdit }) => {
  const [schedulers, setSchedulers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Prevent mouse wheel scroll on number inputs
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.type === 'number') {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

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

  const handleEdit = (scheduler) => {
    onEdit(scheduler);
  };

  const handleSetActive = async (id, name) => {
    const isActive = schedulers.find(s => s.id === id)?.isActive;
    
    try {
      const response = await fetch(`/api/batch-schedulers/${id}/set-active`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        fetchSchedulers();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      alert('❌ ไม่สามารถเปลี่ยนสถานะ Scheduler ได้');
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
          : 'ทุกวันเวลา 00.00';
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
    const lastRun = scheduler.lastRun;
    
    return (
      <div className="flex flex-col gap-1">
        <div className={`px-2 py-1 rounded text-xs font-medium text-center ${
          isActive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
        </div>
        {lastRun && (
          <div className={`px-1 py-0.5 rounded text-xs text-center ${
            lastRun.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
            lastRun.status === 'FAILED' ? 'bg-red-100 text-red-800' : 
            'bg-yellow-100 text-yellow-800'
          }`}>
            {lastRun.status === 'COMPLETED' ? '✅' : lastRun.status === 'FAILED' ? '❌' : '🔄'} {lastRun.status}
          </div>
        )}
      </div>
    );
  };

  const getActiveSchedulerBadge = () => {
    const activeSchedulers = schedulers.filter(s => s.isActive);
    
    if (activeSchedulers.length === 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-sm">
          ⚠️ ไม่มี Active Scheduler
        </div>
      );
    }
    
    if (activeSchedulers.length > 1) {
      return (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm">
          ⚠️ มี {activeSchedulers.length} Active Scheduler
        </div>
      );
    }
    
    return (
      <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm">
        ✅ Active: {activeSchedulers[0].name}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-screen overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="m-0 text-2xl font-bold text-gray-900">
                จัดการ Batch Scheduler
              </h2>
              <p className="m-0 text-sm text-gray-600">
                ดูและจัดการการตั้งเวลาดึงอีเมลอัตโนมัติ
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchSchedulers}
              disabled={loading}
              className={`p-2 bg-green-500 text-white border-none rounded-lg flex items-center gap-1 transition-opacity ${
                loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-green-600'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit()}
              className="px-4 py-2 bg-blue-600 text-white border-none rounded-lg cursor-pointer flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              สร้างใหม่
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-6">
          {/* Active Scheduler Status */}
          <div className="mb-4">
            {getActiveSchedulerBadge()}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="text-gray-600">กำลังโหลด...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">เกิดข้อผิดพลาด:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && schedulers.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่มี Batch Scheduler</h3>
              <p className="text-gray-600 mb-4">สร้าง scheduler ใหม่เพื่อเริ่มดึงอีเมลอัตโนมัติ</p>
              <button
                onClick={() => onEdit()}
                className="px-4 py-2 bg-blue-600 text-white border-none rounded-lg cursor-pointer flex items-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                สร้าง Scheduler ใหม่
              </button>
            </div>
          )}

          {!loading && !error && schedulers.length > 0 && (
            <div className="flex flex-col gap-4">
              {schedulers.map((scheduler) => (
                <div key={scheduler.id} className="bg-white rounded-lg shadow-md p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-900">{scheduler.name}</h3>
                        {getStatusBadge(scheduler)}
                        <button
                          onClick={() => handleEdit(scheduler)}
                          className="p-1.5 bg-gray-100 text-gray-600 border-none rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                          title="แก้ไข Scheduler"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">📦 Batch Size</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {scheduler.batchSize} อีเมล/รอบ
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">⏰ กำหนดการ</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {getScheduleDescription(scheduler)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">📅 ช่วงวันที่</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {new Date(scheduler.startDate).toLocaleDateString('th-TH')}
                            {scheduler.endDate ? ` - ${new Date(scheduler.endDate).toLocaleDateString('th-TH')}` : ' (ไม่จำกัด)'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">🕐 รันครั้งล่าสุด</div>
                          <div className="text-sm text-gray-900">
                            {scheduler.lastRunAt ? formatThaiTime(scheduler.lastRunAt) : 'ยังไม่เคยรัน'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">⚡ รันครั้งถัดไป</div>
                          <div className="text-sm text-blue-600 font-semibold">
                            {scheduler.nextRunAt ? formatThaiTime(scheduler.nextRunAt) : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">📊 จำนวนรอบที่รัน</div>
                          <div className="text-sm text-gray-900">
                            {scheduler.batchRuns?.length || 0} รอบ
                          </div>
                        </div>
                      </div>

                      {scheduler.batchRuns && scheduler.batchRuns.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs text-gray-600 mb-2">📋 รอบล่าสุด:</div>
                          <div className="flex gap-2 flex-wrap">
                            {scheduler.batchRuns.slice(0, 5).map((run) => (
                              <div key={run.id} className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">
                                <span className="font-semibold text-black">#{run.batchNumber}</span>
                                <span className="ml-1 text-gray-600">
                                  {run.status === 'COMPLETED' ? `✅ ${run.emailsProcessed}` : 
                                   run.status === 'FAILED' ? '❌' : '🔄'}
                                </span>
                                <span className="ml-1 text-gray-400 text-2xs">
                                  {run.createdAt ? new Date(run.createdAt).toLocaleDateString('th-TH') : 'Invalid Date'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleSetActive(scheduler.id, scheduler.name)}
                        className={`px-4 py-2 border-none rounded-lg cursor-pointer flex items-center gap-2 text-sm transition-colors ${
                          scheduler.isActive 
                            ? 'bg-orange-500 text-white hover:bg-orange-600' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {scheduler.isActive ? 'เลือก Scheduler แล้ว' : 'เลือก Scheduler'}
                      </button>
                      <button
                        onClick={() => handleRunNow(scheduler.id, scheduler.name)}
                        className="px-4 py-2 bg-green-500 text-white border-none rounded-lg cursor-pointer flex items-center gap-2 text-sm hover:bg-green-600 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        รันทันที
                      </button>
                      <button
                        onClick={() => handleDelete(scheduler.id, scheduler.name)}
                        className="px-4 py-2 bg-red-500 text-white border-none rounded-lg cursor-pointer flex items-center gap-2 text-sm hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
