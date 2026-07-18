import { useState, useRef, useEffect } from 'react';
import './YearSelector.css';

export default function YearSelector({ years, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="year-selector-container" ref={containerRef}>
      <button 
        type="button" 
        className="year-selector-trigger" 
        onClick={() => setOpen(!open)}
        aria-label="Select year"
        aria-expanded={open}
      >
        <span>{value}</span>
        <svg 
          className={`year-selector-chevron ${open ? 'open' : ''}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="year-selector-dropdown">
          {years.map((year) => (
            <li key={year}>
              <button
                type="button"
                className={`year-selector-option ${year === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(year);
                  setOpen(false);
                }}
              >
                {year}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
