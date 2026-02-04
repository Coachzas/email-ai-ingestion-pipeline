import React, { useMemo } from 'react'

interface SearchableLogProps {
  content: string
  searchTerm: string
  onSearchChange: (term: string) => void
}

const SearchableLog: React.FC<SearchableLogProps> = ({ 
  content, 
  searchTerm, 
  onSearchChange 
}) => {
  const highlightedContent = useMemo(() => {
    if (!searchTerm.trim()) {
      return content
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = content.split(regex)

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
  }, [content, searchTerm])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value)
  }

  const clearSearch = () => {
    onSearchChange('')
  }

  return (
    <div className="searchable-log">
      <div className="search-controls">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="ค้นหาใน log..."
            className="search-input"
            aria-label="ค้นหาใน log"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="clear-search-btn"
              aria-label="ล้างการค้นหา"
            >
              ×
            </button>
          )}
        </div>
        {searchTerm && (
          <div className="search-info">
            กำลังค้นหา: <strong>"{searchTerm}"</strong>
          </div>
        )}
      </div>
      
      <div className="log-content">
        <pre 
          id="log" 
          role="log" 
          aria-live="polite"
          aria-label="บันทึกการดำเนินการ"
          tabIndex={0}
        >
          {highlightedContent}
        </pre>
      </div>
    </div>
  )
}

export default SearchableLog
