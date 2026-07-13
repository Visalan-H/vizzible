import React, { useEffect, useState } from 'react';
import './SideDecorations.css';

const MOCK_EVENTS = [
  { type: 'git', text: 'pushed 3 commits to main' },
  { type: 'lc', text: 'solved Daily Challenge (Medium)' },
  { type: 'cf', text: 'accepted on Problem D (1600)' },
  { type: 'git', text: 'created pull request #14' },
  { type: 'lc', text: 'active streak reached 18 days' },
  { type: 'cf', text: 'rating change: +42 (Expert)' },
  { type: 'git', text: 'merged branch feature/auth-fix' },
  { type: 'lc', text: 'solved Hard problem (Binary Index Tree)' },
  { type: 'cf', text: 'registered for Round #982 (Div 2)' },
  { type: 'git', text: 'released v1.0.4-alpha' },
];

const ICONS = {
  git: '', // Git icon representation or custom text
  lc: '', 
  cf: ''
};

export default function SideDecorations() {
  const [events, setEvents] = useState([
    { id: 1, type: 'git', text: 'initialized activity listener...' },
    { id: 2, type: 'lc', text: 'synced LeetCode handle' },
    { id: 3, type: 'cf', text: 'synced Codeforces handle' }
  ]);

  // Feed animation: add mock event every 3.5s
  useEffect(() => {
    let idCounter = 4;
    const interval = setInterval(() => {
      const nextEvent = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)];
      setEvents(prev => {
        const updated = [...prev, { id: idCounter++, ...nextEvent }];
        if (updated.length > 6) {
          updated.shift();
        }
        return updated;
      });
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="side-decorations" aria-hidden="true">
      {/* Left Panel: Animated Scrolling Terminal Feed */}
      <div className="side-panel left-panel">
        <div className="decor-card terminal-decor">
          <div className="decor-header">
            <span className="dot red"></span>
            <span className="dot yellow"></span>
            <span className="dot green"></span>
            <span className="decor-title-text">live_stream.log</span>
          </div>
          <div className="terminal-feed">
            {events.map((e) => (
              <div key={e.id} className="feed-line animate-slide-in">
                <span className={`tag ${e.type}`}>[{e.type}]</span> {e.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Animated Telemetry & Pulsing Heatmap */}
      <div className="side-panel right-panel">
        <div className="decor-card telemetry-decor">
          <div className="decor-header">
            <span className="decor-title-text">telemetry_matrix</span>
            <span className="pulse-indicator"></span>
          </div>
          <div className="telemetry-body">
            <div className="decor-grid-animated">
              {Array(36).fill(null).map((_, i) => {
                // Statically distribute levels, but they pulse in CSS
                const level = (i * 3 + 1) % 5;
                const delay = (i % 6) * 0.15 + (Math.floor(i / 6) * 0.15);
                return (
                  <div
                    key={i}
                    className={`decor-cell pulse-cell level-${level}`}
                    style={{ animationDelay: `${delay}s` }}
                  />
                );
              })}
            </div>
            <div className="mini-status">
              <div className="status-item">
                <span className="lbl">CPU LOAD</span>
                <div className="progress-bar"><div className="fill cpu-fill"></div></div>
              </div>
              <div className="status-item">
                <span className="lbl">SYNC</span>
                <span className="val green-text">99.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
