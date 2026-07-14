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
        if (updated.length > 3) {
          updated.shift();
        }
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Grayscale levels for the 3D isometric board
  const isoCells = [
    { level: 1, type: 'empty' }, { level: 3, type: 'active-medium' }, { level: 0, type: 'empty' }, { level: 2, type: 'active-low' },
    { level: 0, type: 'empty' }, { level: 1, type: 'active-low' }, { level: 4, type: 'active-high' }, { level: 0, type: 'empty' },
    { level: 2, type: 'active-low' }, { level: 0, type: 'empty' }, { level: 2, type: 'active-medium' }, { level: 3, type: 'active-high' },
    { level: 4, type: 'active-high' }, { level: 1, type: 'empty' }, { level: 3, type: 'active-medium' }, { level: 0, type: 'empty' }
  ];

  return (
    <div className="side-decorations" aria-hidden="true">
      {/* Left Panel: Holographic Merging Hub + Feed */}
      <div className="side-panel left-panel">
        <div className="decor-card futuristic-card hub-card">
          <div className="decor-glow"></div>
          
          <div className="decor-header-futuristic">
            <span className="hologram-tag">LIVE SYNC HUB</span>
            <div className="status-wave">
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
            </div>
          </div>

          {/* Monochrome merging SVG */}
          <div className="svg-hub-container">
            <svg width="100%" height="80" viewBox="0 0 200 80" className="hub-svg">
              <circle cx="25" cy="20" r="5" fill="var(--text-mute)" className="hub-node pulse-node-git" />
              <circle cx="25" cy="40" r="5" fill="var(--text-mute)" className="hub-node pulse-node-lc" />
              <circle cx="25" cy="60" r="5" fill="var(--text-mute)" className="hub-node pulse-node-cf" />
              
              <path d="M 30 20 Q 90 20 130 40" stroke="var(--text-ash)" strokeWidth="1.5" fill="none" strokeDasharray="5 5" className="hub-path path-git" />
              <path d="M 30 40 Q 90 40 130 40" stroke="var(--text-ash)" strokeWidth="1.5" fill="none" strokeDasharray="5 5" className="hub-path path-lc" />
              <path d="M 30 60 Q 90 60 130 40" stroke="var(--text-ash)" strokeWidth="1.5" fill="none" strokeDasharray="5 5" className="hub-path path-cf" />

              <circle cx="135" cy="40" r="7" fill="var(--ink)" className="hub-center-node" />
              <circle cx="135" cy="40" r="13" stroke="var(--ink)" strokeWidth="1" fill="none" className="hub-pulse-ring" />
            </svg>
          </div>

          <div className="futuristic-feed">
            {events.map((e) => (
              <div key={e.id} className={`feed-bubble animate-bubble-in feed-${e.platform}`}>
                <span className={`feed-dot-badge badge-${e.platform}`}></span>
                <span className="feed-bubble-text">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Isometric 3D Heatmap + Grayscale Streak */}
      <div className="side-panel right-panel">
        <div className="decor-card futuristic-card decor-streak-card">
          <div className="decor-glow"></div>
          
          <div className="decor-header-futuristic">
            <span className="hologram-tag">GLOBAL STREAK</span>
            <div className="fire-indicator">
              <svg className="streak-fire-svg" viewBox="0 0 24 24" width="18" height="18">
                <path d="M12 2C12 2 17 6.5 17 11.5C17 14.5 14.5 17 12 17C9.5 17 7 14.5 7 11.5C7 6.5 12 2 12 2Z" fill="#ff4500" />
                <path d="M12 6C12 6 15 9 15 12C15 14 13.5 15.5 12 15.5C10.5 15.5 9 14 9 12C9 9 12 6 12 6Z" fill="#ffa116" />
              </svg>
            </div>
          </div>

          <div className="streak-counter-glow">
            <span className="streak-value-number">42</span>
            <span className="streak-lbl">DAY STREAK</span>
          </div>

          {/* Slanted 3D Isometric Mini Heatmap */}
          <div className="iso-container">
            <div className="isometric-grid">
              {isoCells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`iso-cell ${cell.type} depth-${cell.level}`}
                  style={{ animationDelay: `${idx * 0.08}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
