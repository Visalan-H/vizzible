import './PlatformToggle.css';

const OPTIONS = [
  {
    value: 'combined',
    label: 'Combined',
    shortLabel: 'All',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    )
  },
  {
    value: 'github',
    label: 'GitHub',
    shortLabel: 'GH',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.747-1.026 2.747-1.026.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.523 2 12 2z" />
      </svg>
    )
  },
  {
    value: 'codeforces',
    label: 'Codeforces',
    shortLabel: 'CF',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="11" width="4" height="10" rx="0.5"/>
        <rect x="10" y="3" width="4" height="18" rx="0.5"/>
        <rect x="17" y="7" width="4" height="14" rx="0.5"/>
      </svg>
    )
  },
  {
    value: 'leetcode',
    label: 'LeetCode',
    shortLabel: 'LC',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
        <line x1="14" y1="4" x2="10" y2="20"/>
      </svg>
    )
  }
];

export default function PlatformToggle({ value, onChange }) {
  const activeIndex = OPTIONS.findIndex((option) => option.value === value);

  return (
    <div className="platform-toggle">
      <div
        className="platform-toggle-slider"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`platform-toggle-btn ${option.value === value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          {option.icon}
          <span className="toggle-label">{option.label}</span>
          <span className="toggle-label-short">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
