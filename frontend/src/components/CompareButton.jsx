import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CompareButton.css';

function CompareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="M16 21l4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}

// Profile-page entry point into Compare (PLAN.md §1.5). A full searchable
// picker is deferred - typing a second username and hitting enter is
// "good enough for v1", so this is just a trigger button that reveals a
// single inline input, same click-outside-to-close pattern as
// YearSelector. `username` is whichever profile is on screen; it becomes
// userA in the resulting /compare/:userA/:userB URL.
export default function CompareButton({ username }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    const other = value.trim();
    if (!other) return;

    // Same-user guard, mirrored client-side here (Compare.jsx also checks
    // this once the page loads) so this never even navigates to a
    // pointless /compare/alice/alice.
    if (other.toLowerCase() === username.toLowerCase()) {
      setError(true);
      return;
    }

    navigate(`/compare/${encodeURIComponent(username)}/${encodeURIComponent(other)}`);
  }

  return (
    <div className="compare-button-container" ref={containerRef}>
      <button
        type="button"
        className="btn-secondary compare-trigger-btn"
        onClick={() => setOpen((v) => !v)}
        title="Compare with another profile"
      >
        <CompareIcon />
        <span>Compare</span>
      </button>

      {open && (
        <form className="compare-trigger-dropdown" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="text-input compare-trigger-input"
            placeholder="Compare with..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          <button type="submit" className="btn-primary compare-trigger-submit">Go</button>
          {error && <span className="compare-trigger-error">Pick a different profile.</span>}
        </form>
      )}
    </div>
  );
}
