import React, { useEffect, useState } from 'react';
import './SideDecorations.css';

const MOCK_EVENTS = [
  { platform: 'github', text: '+3 commits to main' },
  { platform: 'leetcode', text: 'Daily Challenge solved' },
  { platform: 'codeforces', text: 'Accepted on Problem D' },
  { platform: 'github', text: 'Created PR #14' },
  { platform: 'leetcode', text: 'Streak reached 18 days' },
  { platform: 'codeforces', text: 'Expert tier reached' },
  { platform: 'github', text: 'Merged branch feat/auth' },
  { platform: 'leetcode', text: 'Solved Hard problem' },
];

export default function SideDecorations() {
  const [events, setEvents] = useState([
    { id: 1, platform: 'github', text: 'contribution graph synced' },
    { id: 2, platform: 'leetcode', text: 'daily progress synced' },
    { id: 3, platform: 'codeforces', text: 'contest rating updated' }
  ]);

  // Feed animation
  useEffect(() => {
    let idCounter = 4;
    const interval = setInterval(() => {
      const nextEvent = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
      setEvents(prev => {
        const updated = [...prev, { id: idCounter++, ...nextEvent }];
        if (updated.length > 4) {
          updated.shift();
        }
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Simple 2D grid cells for mini heatmap
  const gridCells = [
    1, 3, 0, 2,
    0, 1, 4, 0,
    2, 0, 2, 3,
    4, 1, 3, 0
  ];

  return (
    <div className="side-decorations" aria-hidden="true">
      {/* Left Panel: Sync Status & Feed */}
      <div className="side-panel left-panel">
        <div className="decor-card">
          <div className="decor-header">
            <span className="section-label">live sync</span>
            <div className="status-indicator">
              <span className="status-dot"></span>
            </div>
          </div>

          <div className="svg-hub-container">
            <svg width="100%" height="60" viewBox="0 0 200 60" className="hub-svg">
              <circle cx="25" cy="15" r="4" className="hub-node" />
              <circle cx="25" cy="30" r="4" className="hub-node" />
              <circle cx="25" cy="45" r="4" className="hub-node" />
              
              <path d="M 29 15 Q 90 15 130 30" fill="none" strokeWidth="1" className="hub-path" />
              <path d="M 29 30 Q 90 30 130 30" fill="none" strokeWidth="1" className="hub-path" />
              <path d="M 29 45 Q 90 45 130 30" fill="none" strokeWidth="1" className="hub-path" />

              <circle cx="135" cy="30" r="6" className="hub-center-node" />
            </svg>
          </div>

          <div className="feed-list">
            {events.map((e) => (
              <div key={e.id} className="feed-item">
                <span className={`feed-dot platform-${e.platform}`}></span>
                <span className="feed-text">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Streak & Heatmap */}
      <div className="side-panel right-panel">
        <div className="decor-card">
          <div className="decor-header">
            <span className="section-label">global streak</span>
          </div>

          <div className="streak-display">
            <span className="streak-value">42</span>
            <span className="streak-label">days</span>
          </div>

          <div className="mini-heatmap">
            {gridCells.map((level, idx) => (
              <div key={idx} className={`heatmap-cell level-${level}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
