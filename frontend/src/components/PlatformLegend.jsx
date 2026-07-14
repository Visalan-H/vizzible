import { PLATFORM_COLORS } from '../utils/platformColors';
import './PlatformLegend.css';

const ENTRIES = [
  { key: 'github', label: 'GitHub' },
  { key: 'codeforces', label: 'Codeforces' },
  { key: 'leetcode', label: 'LeetCode' },
];

// Only shown on the combined tab - a single-platform tab is already
// unambiguous (one color, and the tab you clicked says which), so a
// legend there would just be restating the obvious.
export default function PlatformLegend() {
  return (
    <div className="platform-legend">
      {ENTRIES.map(({ key, label }) => (
        <span className="platform-legend-item" key={key}>
          <span className="platform-legend-dot" style={{ background: PLATFORM_COLORS[key] }} />
          {label}
        </span>
      ))}
    </div>
  );
}
