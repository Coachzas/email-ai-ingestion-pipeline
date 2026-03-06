import React, { useState, useEffect } from 'react';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [showFileData, setShowFileData] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/file-upload/files');
      const result = await response.json();
      
      if (result.success) {
        setFiles(result.data);
      } else {
        console.error('Failed to fetch files:', result.message);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('กรุณาเลือกไฟล์ที่จะอัปโหลด');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploading(true);
      const response = await fetch('/api/file-upload/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ อัปโหลดไฟล์สำเร็จ!');
        setSelectedFile(null);
        document.getElementById('file-input').value = '';
        await fetchFiles();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileName) => {
    if (!confirm(`ต้องการลบไฟล์ "${fileName}" หรือไม่?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/file-upload/files/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ ลบไฟล์สำเร็จ');
        await fetchFiles();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('❌ เกิดข้อผิดพลาดในการลบไฟล์');
    }
  };

  const handleRename = async (oldFileName) => {
    const newFileName = prompt(`เปลี่ยนชื่อใหม่สำหรับไฟล์ "${oldFileName}":`, oldFileName);
    
    if (!newFileName || newFileName.trim() === '') {
      return;
    }

    // ตรวจสอบนามสกุลไฟล์
    const fileExtension = oldFileName.split('.').pop();
    const finalFileName = newFileName.endsWith(`.${fileExtension}`) 
      ? newFileName 
      : `${newFileName}.${fileExtension}`;

    try {
      const response = await fetch(`/api/file-upload/files/${encodeURIComponent(oldFileName)}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newFileName: finalFileName }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ เปลี่ยนชื่อไฟล์สำเร็จ');
        await fetchFiles();
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อไฟล์');
    }
  };

  const handleViewData = async (fileName) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/file-upload/files/${encodeURIComponent(fileName)}/read`);
      const result = await response.json();

      if (result.success) {
        setFileData(result.data);
        setShowFileData(true);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error('Read file error:', error);
      alert('❌ เกิดข้อผิดพลาดในการอ่านไฟล์');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('th-TH');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>📁 จัดการไฟล์ CSV/Excel</h2>
      
      {/* Upload Section */}
      <div style={{
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3>อัปโหลดไฟล์ใหม่</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            style={{
              backgroundColor: '#222',
              border: '1px solid #444',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedFile && !uploading ? '#28a745' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFile && !uploading ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              opacity: selectedFile && !uploading ? 1 : 0.6
            }}
          >
            {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดไฟล์'}
          </button>
        </div>
        {selectedFile && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#bbb' }}>
            ไฟล์ที่เลือก: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </div>
        )}
      </div>

      {/* Files List */}
      <div style={{
        backgroundColor: '#111',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h3>ไฟล์ที่อัปโหลดแล้ว</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>กำลังโหลด...</div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            ยังไม่มีไฟล์ที่อัปโหลด
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>ชื่อไฟล์</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>ขนาด</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>อัปโหลดเมื่อ</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '10px' }}>
                      <span 
                        onClick={() => handleRename(file.fileName)}
                        style={{
                          color: '#4dabf7',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: '14px'
                        }}
                        title="คลิกเพื่อเปลี่ยนชื่อ"
                      >
                        {file.fileName.endsWith('.csv') ? '📄' : '📊'} {file.fileName}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#bbb' }}>
                      {formatFileSize(file.fileSize)}
                    </td>
                    <td style={{ padding: '10px', color: '#bbb' }}>
                      {formatDate(file.uploadDate)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewData(file.fileName)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#007bff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '5px'
                        }}
                      >
                        ดูข้อมูล
                      </button>
                      <button
                        onClick={() => handleDelete(file.fileName)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Data Modal */}
      {showFileData && fileData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            minWidth: '600px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>📊 ข้อมูลไฟล์: {fileData.fileName}</h3>
              <button
                onClick={() => setShowFileData(false)}
                style={{
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {fileData.sheets.map((sheet, sheetIndex) => (
              <div key={sheetIndex} style={{ marginBottom: '20px' }}>
                <h4>Sheet: {sheet.sheetName}</h4>
                <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '10px' }}>
                  จำนวนแถว: {sheet.rowCount} | คอลัมน์: {sheet.columns.join(', ')}
                </div>
                
                {sheet.preview.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '12px',
                      backgroundColor: '#222'
                    }}>
                      <thead>
                        <tr style={{ backgroundColor: '#333' }}>
                          {sheet.columns.map((col, colIndex) => (
                            <th key={colIndex} style={{
                              padding: '8px',
                              textAlign: 'left',
                              border: '1px solid #444',
                              fontWeight: 'bold'
                            }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.preview.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {sheet.columns.map((col, colIndex) => (
                              <td key={colIndex} style={{
                                padding: '6px 8px',
                                border: '1px solid #444',
                                color: '#fff'
                              }}>
                                {row[col] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
