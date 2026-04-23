export const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

export const formatThaiTime = (date) => {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString('th-TH');
  }
};

export const getCountdown = (targetDate, now) => {
  if (!targetDate) return null;
  
  const diffMs = targetDate.getTime() - now.getTime();
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
};
