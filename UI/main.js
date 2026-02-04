const { useState } = React;

function App() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [log, setLog] = useState('รอคำสั่ง...');

  const fetchEmails = async () => {
    setLog('⏳ กำลังดึงอีเมล...');
    try {
      const res = await fetch('/api/ingest/fetch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null }),
      });

      const data = await res.json();
      setLog('✅ สำเร็จ\n\n' + JSON.stringify(data, null, 2));
    } catch (err) {
      setLog('❌ Error: ' + err.message);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>📧 Email AI Pipeline</h1>
      <p>เลือกช่วงวันที่เพื่อดึงอีเมลจาก IMAP</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label>
          เริ่มต้น
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          สิ้นสุด
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button onClick={fetchEmails}>📥 ดึงอีเมล</button>
      </div>

      <pre id="log" style={{ marginTop: 20, background: '#111', color: '#0f0', padding: 16, whiteSpace: 'pre-wrap' }}>{log}</pre>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
