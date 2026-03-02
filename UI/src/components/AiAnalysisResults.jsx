import React, { useState } from 'react'

export default function AiAnalysisResults({ 
  results, 
  onClose
}) {
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  if (!results || results.length === 0) return null

  const totalCandidates = results.length
  const highestScore = Math.max(...results.map(r => r.score))
  const averageScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)

  const viewDetails = (candidate) => {
    setSelectedCandidate(candidate)
  }

  const closeDetails = () => {
    setSelectedCandidate(null)
  }

  return (
    <div className="ai-results-overlay">
      <div className="ai-results-modal">
        <div className="results-header">
          <h3>📊 ผลลัพธ์การวิเคราะห์</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="results-content">
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">👥</div>
              <div className="card-content">
                <h4>ผู้สมัครทั้งหมด</h4>
                <span className="card-number">{totalCandidates}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">🏆</div>
              <div className="card-content">
                <h4>คะแนนสูงสุด</h4>
                <span className="card-number">{highestScore}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <h4>คะแนนเฉลี่ย</h4>
                <span className="card-number">{averageScore}</span>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="results-table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ตำแหน่ง</th>
                  <th>คะแนน</th>
                  <th>ทักษะหลัก</th>
                  <th>สถานะ</th>
                  <th>ดูรายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {results.map((candidate, index) => (
                  <tr key={candidate.id || index}>
                    <td className="candidate-name">{candidate.name}</td>
                    <td className="candidate-position">{candidate.position}</td>
                    <td className="candidate-score">
                      <span className={`score-badge ${candidate.score >= 80 ? 'high' : candidate.score >= 60 ? 'medium' : 'low'}`}>
                        {candidate.score}/100
                      </span>
                    </td>
                    <td className="candidate-skills">
                      <div className="skills-tags">
                        {candidate.skills?.slice(0, 3).map(skill => (
                          <span key={skill.name} className="skill-tag">
                            {skill.name}
                          </span>
                        ))}
                        {candidate.skills?.length > 3 && (
                          <span className="skill-more">+{candidate.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="candidate-status">
                      <span className={`status-badge ${candidate.status?.toLowerCase()}`}>
                        {candidate.status}
                      </span>
                    </td>
                    <td className="candidate-actions">
                      <button 
                        className="view-details-btn"
                        onClick={() => viewDetails(candidate)}
                        aria-label="ดูรายละเอียด"
                      >
                        👁️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Candidate Details Modal */}
        {selectedCandidate && (
          <div className="candidate-detail-overlay">
            <div className="candidate-detail-modal">
              <div className="detail-header">
                <h3>👤 {selectedCandidate.name}</h3>
                <div className="detail-score">
                  <span className="score-badge large">
                    {selectedCandidate.score}/100
                  </span>
                </div>
                <button className="close-btn" onClick={closeDetails}>×</button>
              </div>
              
              <div className="detail-content">
                {/* Personal Info */}
                <section className="personal-info">
                  <h4>📝 ข้อมูลส่วนตัว</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>ชื่อ:</strong> {selectedCandidate.name}
                    </div>
                    <div className="info-item">
                      <strong>ตำแหน่ง:</strong> {selectedCandidate.position}
                    </div>
                    <div className="info-item">
                      <strong>อีเมล:</strong> {selectedCandidate.email}
                    </div>
                    <div className="info-item">
                      <strong>โทรศัพท์:</strong> {selectedCandidate.phone}
                    </div>
                  </div>
                </section>

                {/* Skills & Experience */}
                <section className="skills-section">
                  <h4>🔧 ทักษะและประสบการณ์</h4>
                  <div className="skills-grid">
                    {selectedCandidate.skills?.map(skill => (
                      <div key={skill.name} className="skill-item">
                        <span className="skill-name">{skill.name}</span>
                        <span className="skill-level">{skill.level}</span>
                        <span className="skill-years">{skill.years} ปี</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Criteria Matching */}
                <section className="criteria-matching">
                  <h4>📊 การจับคู่เกณฑ์</h4>
                  <div className="criteria-list">
                    {selectedCandidate.criteriaMatches?.map(match => (
                      <div key={match.criteria} className="criteria-item">
                        <span className="criteria-name">{match.criteria}</span>
                        <div className="match-bar">
                          <div 
                            className="match-fill" 
                            style={{width: `${match.percentage}%`}}
                          />
                          <span className="match-percentage">{match.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Original Email */}
                <section className="original-content">
                  <h4>📧 เนื้อหาอีเมลต้นฉบับ</h4>
                  <div className="email-content">
                    {selectedCandidate.originalEmail}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
