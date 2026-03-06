import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Save, X, Settings } from "lucide-react";

const BatchSchedulerModal = ({ isOpen, onClose, onSave, editScheduler }) => {
  const [formData, setFormData] = useState({
    name: "",
    batchSize: 100,
    scheduleType: "daily", // 'daily', 'hourly', 'custom'
    customHour: 2,
    customMinute: 0,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    // Custom schedule fields
    selectedDays: [], // ['MONDAY', 'TUESDAY', ...]
    dayTimeSlots: {}, // New: Per-day time slots {"MONDAY": [{hour: 9, minute: 0}], "TUESDAY": [...]}
  });

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Initialize form data when editScheduler changes
  useEffect(() => {
    if (editScheduler) {
      setFormData({
        name: editScheduler.name || "",
        batchSize: editScheduler.batchSize || 100,
        scheduleType: editScheduler.scheduleType?.toLowerCase() || "daily",
        customHour: editScheduler.customHour || 2,
        customMinute: editScheduler.customMinute || 0,
        startDate: editScheduler.startDate ? new Date(editScheduler.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        endDate: editScheduler.endDate ? new Date(editScheduler.endDate).toISOString().split("T")[0] : "",
        // Custom schedule fields - will be parsed from existing data or defaults
        selectedDays: editScheduler.selectedDays || [],
        dayTimeSlots: editScheduler.dayTimeSlots || {},
      });
    } else {
      // Reset form for new scheduler
      const newScheduler = {
        name: "",
        batchSize: 100,
        scheduleType: "daily",
        customHour: 9,
        customMinute: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        selectedDays: [],
        dayTimeSlots: {}
      };
      setFormData(newScheduler);
    }
  }, [editScheduler, isOpen]);

  // Prevent mouse wheel scroll on number inputs
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.type === "number") {
        e.preventDefault();
      }
    };

    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Ensure customHour and customMinute are properly set for DAILY schedule
    let dataToSave = { ...formData };
    
    if (formData.scheduleType === 'daily') {
      // For DAILY, if no custom time is set, use 00:00
      if (formData.customHour === null || formData.customHour === undefined) {
        dataToSave.customHour = 0;
      }
      if (formData.customMinute === null || formData.customMinute === undefined) {
        dataToSave.customMinute = 0;
      }
    }
    
    // Add editScheduler ID if editing
    if (editScheduler) {
      dataToSave = { ...dataToSave, id: editScheduler.id };
    }
      
    onSave(dataToSave);
    onClose();
  };

  // Per-day time slots functions
  const addDayTimeSlot = (day) => {
    const currentDaySlots = formData.dayTimeSlots[day] || [];
    setFormData({
      ...formData,
      dayTimeSlots: {
        ...formData.dayTimeSlots,
        [day]: [...currentDaySlots, { hour: 9, minute: 0 }]
      }
    });
  };

  const removeDayTimeSlot = (day, index) => {
    const currentDaySlots = formData.dayTimeSlots[day] || [];
    if (currentDaySlots.length > 1) {
      const newDaySlots = currentDaySlots.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        dayTimeSlots: {
          ...formData.dayTimeSlots,
          [day]: newDaySlots
        }
      });
    }
  };

  const updateDayTimeSlot = (day, index, field, value) => {
    const currentDaySlots = formData.dayTimeSlots[day] || [];
    const newDaySlots = [...currentDaySlots];
    newDaySlots[index] = { ...newDaySlots[index], [field]: value };
    setFormData({
      ...formData,
      dayTimeSlots: {
        ...formData.dayTimeSlots,
        [day]: newDaySlots
      }
    });
  };

  const toggleDay = (day) => {
    if (formData.selectedDays.includes(day)) {
      // Remove day and its time slots
      const newDays = formData.selectedDays.filter(d => d !== day);
      const newDayTimeSlots = { ...formData.dayTimeSlots };
      delete newDayTimeSlots[day];
      setFormData({ 
        ...formData, 
        selectedDays: newDays,
        dayTimeSlots: newDayTimeSlots
      });
    } else {
      // Add day with default time slot
      const newDays = [...formData.selectedDays, day];
      const newDayTimeSlots = { 
        ...formData.dayTimeSlots,
        [day]: [{ hour: 9, minute: 0 }] // Default to 9:00
      };
      setFormData({ 
        ...formData, 
        selectedDays: newDays,
        dayTimeSlots: newDayTimeSlots
      });
    }
  };

  const getScheduleDescription = () => {
    switch (formData.scheduleType) {
      case "daily":
        return formData.customHour !== null && formData.customMinute !== null
          ? `ทุกวันเวลา ${String(formData.customHour).padStart(2, '0')}:${String(formData.customMinute).padStart(2, '0')}`
          : 'ทุกวันเวลา 00:00';
      case "hourly":
        return "ทุกชั่วโมง";
      case "custom":
        if (formData.selectedDays.length === 0) {
          return "กำหนดเอง (ยังไม่เลือกวัน)";
        }
        const dayNames = {
          'MONDAY': 'จันทร์', 'TUESDAY': 'อังคาร', 'WEDNESDAY': 'พุธ',
          'THURSDAY': 'พฤหัส', 'FRIDAY': 'ศุกร์', 'SATURDAY': 'เสาร์', 'SUNDAY': 'อาทิตย์'
        };
        
        // Check if we have per-day time slots
        const hasPerDaySlots = Object.keys(formData.dayTimeSlots).length > 0;
        
        if (hasPerDaySlots) {
          const descriptions = formData.selectedDays.map(day => {
            const daySlots = formData.dayTimeSlots[day] || [];
            const times = daySlots.length > 0 
              ? daySlots.map(slot => 
                  `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
                ).join(', ')
              : 'ไม่ได้กำหนด';
            return `${dayNames[day]}: ${times}`;
          });
          return descriptions.join(' | ');
        }
        
        // If no per-day slots, show error
        return "กำหนดเอง (ยังไม่ได้กำหนดเวลา)";
      default:
        return formData.scheduleType;
    }
  };

  const nextRunAt = useMemo(() => {
    const next = new Date(now);
    
    if (formData.scheduleType === "hourly") {
      next.setSeconds(0, 0);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      return next;
    }

    if (formData.scheduleType === "daily") {
      const dailyHour = formData.customHour !== null && formData.customMinute !== null 
        ? formData.customHour 
        : 0;
      const dailyMinute = formData.customHour !== null && formData.customMinute !== null 
        ? formData.customMinute 
        : 0;
      
      next.setHours(dailyHour, dailyMinute, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }

    if (formData.scheduleType === "custom") {
      // Custom schedule: find next selected day
      if (formData.selectedDays.length === 0) {
        return null;
      }

      const dayMap = {
        'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
        'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
      };

      // Sort selected days and convert to day numbers
      const selectedDayNumbers = formData.selectedDays
        .map(day => dayMap[day])
        .sort((a, b) => a - b);

      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Find next run time
      let nextRun = null;
      
      // Check if we have per-day time slots
      const hasPerDaySlots = Object.keys(formData.dayTimeSlots).length > 0;
      
      if (hasPerDaySlots) {
        // Per-day time slots logic
        for (const dayNumber of selectedDayNumbers) {
          const dayName = Object.keys(dayMap).find(key => dayMap[key] === dayNumber);
          const daySlots = formData.dayTimeSlots[dayName] || [];
          
          if (daySlots.length === 0) continue;
          
          // If this day is today, check for future time slots
          if (dayNumber === currentDay) {
            const todaySlots = daySlots
              .map(slot => slot.hour * 60 + slot.minute)
              .filter(time => time > currentTime)
              .sort((a, b) => a - b);
            
            if (todaySlots.length > 0) {
              const nextSlot = todaySlots[0];
              nextRun = new Date(now);
              nextRun.setHours(Math.floor(nextSlot / 60), nextSlot % 60, 0, 0);
              return nextRun;
            }
          } else if (dayNumber > currentDay) {
            // Future day - use first time slot
            const firstSlot = daySlots
              .map(slot => slot.hour * 60 + slot.minute)
              .sort((a, b) => a - b)[0];
            
            nextRun = new Date(now);
            nextRun.setDate(nextRun.getDate() + (dayNumber - currentDay));
            nextRun.setHours(Math.floor(firstSlot / 60), firstSlot % 60, 0, 0);
            return nextRun;
          }
        }
        
        // If no future day found this week, go to next week
        const nextDay = selectedDayNumbers[0];
        const dayName = Object.keys(dayMap).find(key => dayMap[key] === nextDay);
        const daySlots = formData.dayTimeSlots[dayName] || [];
        
        if (daySlots.length > 0) {
          const firstSlot = daySlots
            .map(slot => slot.hour * 60 + slot.minute)
            .sort((a, b) => a - b)[0];
          
          nextRun = new Date(now);
          nextRun.setDate(nextRun.getDate() + (7 - currentDay + nextDay));
          nextRun.setHours(Math.floor(firstSlot / 60), firstSlot % 60, 0, 0);
          return nextRun;
        }
      }
      
      // If no per-day slots, return null
      return null;
    }

    return null;
  }, [formData.customHour, formData.customMinute, formData.scheduleType, formData.selectedDays, formData.dayTimeSlots, now]);

  const countdownText = useMemo(() => {
    if (!nextRunAt) return "";
    const diffMs = nextRunAt.getTime() - now.getTime();
    if (diffMs <= 0) return "กำลังเริ่มทำงาน...";

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days) parts.push(`${days} วัน`);
    if (hours || days) parts.push(`${String(hours).padStart(2, "0")} ชม.`);
    parts.push(`${String(minutes).padStart(2, "0")} นาที`);
    parts.push(`${String(seconds).padStart(2, "0")} วิ`);
    return parts.join(" ");
  }, [nextRunAt, now]);

  const formatThaiTime = (date) => {
    try {
      return new Intl.DateTimeFormat("th-TH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return date.toLocaleString("th-TH");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-screen overflow-hidden shadow-2xl transform scale-100 transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="m-0 text-2xl font-bold text-gray-900">
                {editScheduler ? 'แก้ไข Batch Scheduler' : 'สร้าง Batch Scheduler'}
              </h2>
              <p className="m-0 text-sm text-gray-600">
                {editScheduler ? 'แก้ไขการตั้งเวลาดึงอีเมลอัตโนมัติ' : 'ตั้งค่าการดึงอีเมลอัตโนมัติตามรอบ'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:bg-gray-100"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="max-h-96 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50">
              <div className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-600">เวลาปัจจุบัน</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {formatThaiTime(now)}
                  </div>

                  <div className="mt-3 flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-56 p-3 rounded-lg bg-white border border-gray-200">
                      <div className="text-sm text-gray-600">
                        จะทำงานครั้งถัดไป
                      </div>
                      <div className="text-base font-bold text-blue-600 mt-1">
                        {nextRunAt ? formatThaiTime(nextRunAt) : "-"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {countdownText ? `อีก ${countdownText}` : ""}
                      </div>
                    </div>

                    <div className="w-56 p-3 rounded-lg bg-white border border-gray-200">
                      <div className="text-sm text-gray-600">
                        รูปแบบการทำงาน
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1">
                        {getScheduleDescription()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label">🏷️ ชื่อ Scheduler</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="form-input"
                placeholder="เช่น Monthly Archive, Hourly Sync"
              />
              <p className="text-xs text-gray-600 mt-1">
                ตั้งชื่อเพื่อแยกแยะ scheduler ต่างๆ
              </p>
            </div>

            {/* Batch Size */}
            <div className="mb-6">
              <label className="form-label">📦 Batch Size (อีเมลต่อรอบ)</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={formData.batchSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 10;
                    setFormData({
                      ...formData,
                      batchSize: Math.min(2000, Math.max(10, value)),
                    });
                  }}
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-base font-medium text-gray-700 bg-white outline-none transition-colors focus:border-blue-600"
                />
                <div className="w-20 text-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {formData.batchSize}
                  </span>
                  <div className="text-xs text-gray-600">อีเมล</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      batchSize: Math.min(2000, formData.batchSize + 50),
                    })
                  }
                  className="px-3 py-1 bg-green-500 text-white rounded-md border-none cursor-pointer text-sm font-medium transition-colors hover:bg-green-600"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      batchSize: Math.min(2000, formData.batchSize + 100),
                    })
                  }
                  className="px-3 py-1 bg-green-500 text-white rounded-md border-none cursor-pointer text-sm font-medium transition-colors hover:bg-green-600"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      batchSize: Math.min(2000, formData.batchSize + 500),
                    })
                  }
                  className="px-3 py-1 bg-green-500 text-white rounded-md border-none cursor-pointer text-sm font-medium transition-colors hover:bg-green-600"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      batchSize: Math.min(2000, formData.batchSize + 1000),
                    })
                  }
                  className="px-3 py-1 bg-green-500 text-white rounded-md border-none cursor-pointer text-sm font-medium transition-colors hover:bg-green-600"
                >
                  +1000
                </button>
              </div>
            </div>

            {/* Schedule Type */}
            <div className="mb-6">
              <label className="form-label">⏰ กำหนดเวลา</label>
              <select
                value={formData.scheduleType}
                onChange={(e) =>
                  setFormData({ ...formData, scheduleType: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base outline-none bg-white cursor-pointer"
              >
                <option value="daily">ทุกวัน (Daily)</option>
                <option value="hourly">ทุกชั่วโมง (Hourly)</option>
                <option value="custom">กำหนดเอง (Custom)</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                {getScheduleDescription()}
              </p>
            </div>

            {/* Custom Time */}
            {formData.scheduleType === "daily" && (
              <div className="mb-6">
                <label className="form-label">
                  🕐 เวลาทำงาน (ชั่วโมง:นาที)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    required
                    value={formData.customHour || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customHour: parseInt(e.target.value),
                      })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-base outline-none text-center"
                    placeholder="00"
                  />
                  <span className="text-xl text-gray-600">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    required
                    value={formData.customMinute || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customMinute: parseInt(e.target.value),
                      })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-base outline-none text-center"
                    placeholder="00"
                  />
                  <span className="text-sm text-gray-600 ml-2">
                    (24 ชั่วโมง)
                  </span>
                </div>
              </div>
            )}

            {/* Custom Schedule - Days and Per-Day Time Slots */}
            {formData.scheduleType === "custom" && (
              <div className="mb-6">
                <label className="form-label">📅 เลือกวันทำงาน</label>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {[
                    { value: 'MONDAY', label: 'จันทร์' },
                    { value: 'TUESDAY', label: 'อังคาร' },
                    { value: 'WEDNESDAY', label: 'พุธ' },
                    { value: 'THURSDAY', label: 'พฤหัส' },
                    { value: 'FRIDAY', label: 'ศุกร์' },
                    { value: 'SATURDAY', label: 'เสาร์' },
                    { value: 'SUNDAY', label: 'อาทิตย์' }
                  ].map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                        formData.selectedDays.includes(day.value)
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                {/* Per-day time slots */}
                <div className="space-y-4">
                  {formData.selectedDays.map(day => {
                    const dayNames = {
                      'MONDAY': 'จันทร์', 'TUESDAY': 'อังคาร', 'WEDNESDAY': 'พุธ',
                      'THURSDAY': 'พฤหัส', 'FRIDAY': 'ศุกร์', 'SATURDAY': 'เสาร์', 'SUNDAY': 'อาทิตย์'
                    };
                    
                    return (
                      <div key={day} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="form-label mb-0">
                            🕐 เวลาทำงาน {dayNames[day]}
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          {(formData.dayTimeSlots[day] || [{ hour: 9, minute: 0 }]).map((slot, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                required
                                value={slot.hour}
                                onChange={(e) => updateDayTimeSlot(day, index, 'hour', parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-base outline-none text-center"
                                placeholder="00"
                              />
                              <span className="text-xl text-gray-600">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                required
                                value={slot.minute}
                                onChange={(e) => updateDayTimeSlot(day, index, 'minute', parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-base outline-none text-center"
                                placeholder="00"
                              />
                              <button
                                type="button"
                                onClick={() => removeDayTimeSlot(day, index)}
                                disabled={(formData.dayTimeSlots[day] || []).length === 1}
                                className="px-3 py-2 bg-red-500 text-white rounded-lg border-none cursor-pointer text-sm font-medium transition-colors hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                              >
                                ลบ
                              </button>
                            </div>
                          ))}
                          
                          <button
                            type="button"
                            onClick={() => addDayTimeSlot(day)}
                            className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg border-none cursor-pointer text-sm font-medium transition-colors hover:bg-green-600"
                          >
                            + เพิ่มเวลา {dayNames[day]}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <p className="text-xs text-gray-600 mt-4">
                  💡 แต่ละวันสามารถกำหนดเวลาทำงานได้หลายเวลา (เช่น จันทร์ 9:00 และ 14:00, อังคาร 10:30)
                </p>
              </div>
            )}

            {/* Date Range */}
            <div className="mb-6">
              <div className="mb-4">
                <label className="form-label">📅 วันที่เริ่มต้นดึงอีเมล</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base outline-none transition-colors focus:border-blue-600"
                />
              </div>
              <div>
                <label className="form-label">
                  📅 วันที่สิ้นสุดดึงอีเมล (ถ้ามี)
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  placeholder="ไม่จำกัด"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base outline-none transition-colors focus:border-blue-600"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                สรุปการตั้งค่า
              </h3>
              <div className="text-sm leading-6 space-y-1">
                {" "}
                {/* เพิ่ม space-y-1 ให้แต่ละบรรทัดห่างกันนิดนึง */}
                {/* เปลี่ยนสีหัวข้อเป็นน้ำเงินเข้ม (text-blue-800) และเนื้อหาเป็นสีเทาเข้ม (text-gray-700) */}
                <div className="text-gray-700">
                  <strong className="text-blue-800">ชื่อ:</strong>{" "}
                  {formData.name || "ยังไม่ระบุ"}
                </div>
                <div className="text-gray-700">
                  <strong className="text-blue-800">Batch Size:</strong>{" "}
                  {formData.batchSize} อีเมล/รอบ
                </div>
                <div className="text-gray-700">
                  <strong className="text-blue-800">กำหนดเวลา:</strong>{" "}
                  {getScheduleDescription()}
                </div>
                <div className="text-gray-700">
                  <strong className="text-blue-800">ช่วงวันที่:</strong>{" "}
                  {formData.startDate}{" "}
                  {formData.endDate ? `ถึง ${formData.endDate}` : "ไม่จำกัด"}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg border-none cursor-pointer text-base font-medium transition-colors hover:bg-gray-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg border-none cursor-pointer text-base font-medium flex items-center justify-center gap-2 transition-colors hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                {editScheduler ? 'อัปเดต' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BatchSchedulerModal;
