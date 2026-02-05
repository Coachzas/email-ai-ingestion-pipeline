import React, { useMemo } from 'react'

const SearchableLog = ({ 
  log, 
  searchTerm, 
  onSearchChange 
}) => {
  const highlightedContent = useMemo(() => {
    if (!searchTerm.trim()) {
      return log
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = log.split(regex)

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} className="highlight">
            {part}
          </span>
        )
      }
      return part
    })
  }, [log, searchTerm])

  return (
    <div className="searchable-log">
      <div className="search-controls">
        <input
          type="text"
          placeholder="ค้นหาใน log..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange('')}
            className="clear-search"
          >
            ×
          </button>
        )}
      </div>
      <div id="log" className="log-content">
        <pre>{highlightedContent}</pre>
      </div>
    </div>
  )
}

export default SearchableLog
