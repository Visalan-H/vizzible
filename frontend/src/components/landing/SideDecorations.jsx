import React from 'react';
import './SideDecorations.css';

export default function SideDecorations() {
  const events = [
    { id: 1, platform: 'github', text: 'contribution graph synced' },
    { id: 2, platform: 'leetcode', text: 'daily progress synced' },
    { id: 3, platform: 'codeforces', text: 'contest rating updated' }
  ];

  // Simple 2D grid cells for mini heatmap: 13 weeks * 7 days = 91 cells
  const gridCells = [
    0, 1, 0, 2, 0, 0, 1,
    3, 0, 0, 1, 2, 0, 0,
    0, 4, 1, 0, 0, 2, 1,
    0, 0, 3, 0, 1, 0, 0,
    2, 1, 0, 0, 4, 0, 2,
    0, 0, 1, 3, 0, 0, 0,
    1, 2, 0, 0, 1, 0, 3,
    0, 0, 4, 2, 0, 1, 0,
    0, 1, 0, 0, 3, 0, 2,
    1, 0, 2, 0, 0, 4, 0,
    0, 3, 1, 0, 1, 0, 0,
    2, 0, 0, 4, 0, 2, 1,
    0, 1, 3, 0, 0, 1, 0
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
            {events.map((e, idx) => (
              <div 
                key={e.id} 
                className="feed-item"
                style={{ animationDelay: `${0.3 + idx * 0.12}s` }}
              >
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
              <div 
                key={idx} 
                className={`heatmap-cell level-${level}`} 
                style={{ animationDelay: `${0.35 + (idx % 7) * 0.04 + Math.floor(idx / 7) * 0.03}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
