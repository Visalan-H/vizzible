// Single source of truth for platform colors - Profile.jsx (tab styling,
// legend), Heatmap.jsx (per-cell dominant-platform coloring in the combined
// view), and MockDashboard.jsx (landing page demo) all import this instead
// of keeping their own copies, so they can't silently drift out of sync.
export const PLATFORM_COLORS = {
  combined: 'var(--ink)',
  github: '#39d353',
  codeforces: '#4a90d9',
  leetcode: '#ffa116',
};

// Maps a platform tab to the field name on an activity-day object that
// holds that platform's count.
export const PLATFORM_KEY = {
  combined: 'total',
  github: 'github',
  codeforces: 'codeforces',
  leetcode: 'leetcode',
};

// Given a day's per-platform breakdown, which platform contributed the
// most that day. Ties resolve github > codeforces > leetcode - arbitrary,
// but consistent, and ties are rare enough (exact equal counts across
// platforms) that any fixed tiebreak is fine.
export function dominantPlatform(day) {
  const { github = 0, codeforces = 0, leetcode = 0 } = day;
  if (github >= codeforces && github >= leetcode) return 'github';
  if (codeforces >= leetcode) return 'codeforces';
  return 'leetcode';
}

// --- Theme-equal intensity math -------------------------------------------
//
// Dark theme represents activity level by opacity of a platform's raw hue
// over a pure-black canvas (25/50/75/100%). That looks great because
// contrast against black grows very cheaply. Blending that *same* hue
// toward the near-white canvas (#F2EDED, see --canvas in index.css) at
// matching opacities can't get anywhere near the same contrast - there's
// just no headroom above white - which is why light mode's activity levels
// read as washed out, and why the OG image (rendered on the same near-
// white canvas, see backend/controllers/profileController.js) had the
// identical problem.
//
// Fix: instead of opacity, light-mode/OG tiers are solid HSL-darkened
// shades of the same hue, each solved by binary search on lightness to
// hit the exact WCAG 2.0 contrast ratio (the same formula browsers/axe use
// for accessibility checks) that dark theme's opacity curve already
// achieves for that tier. A "level 3" day ends up equally intense
// (identical contrast ratio against its own canvas) whichever theme it's
// viewed in, without introducing new colors or touching dark mode's look
// at all - only light mode's numbers change.
const LIGHT_CANVAS = '#F2EDED';
const DARK_CANVAS = '#000000';
const DARK_OPACITIES = [0.25, 0.5, 0.75, 1]; // dark theme's existing level 1-4 curve

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.0 contrast ratio formula: (lighter + 0.05) / (darker + 0.05).
function contrastRatio(hexA, hexB) {
  const L1 = relativeLuminance(hexA);
  const L2 = relativeLuminance(hexB);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function blend(fgHex, bgHex, alpha) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const rgb = fg.map((c, i) => Math.round(bg[i] + (c - bg[i]) * alpha));
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// Binary search: contrast against a near-white canvas falls monotonically
// as lightness rises from 0 (black) to 1 (white) across the WHOLE range,
// regardless of where the base hue itself sits - searching only from 0 to
// the base hue's own lightness assumes every tier needs darkening, but a
// hue that's already fairly dark (codeforces blue) can overshoot an early
// tier's target before any darkening at all, collapsing two tiers into the
// identical color. Searching the full range lets early tiers land on a
// lighter tint when that's what the target actually calls for.
function darkenToContrast(baseHex, bgHex, targetRatio) {
  const [h, s] = hexToHsl(baseHex);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ratio = contrastRatio(hslToHex(h, s, mid), bgHex);
    if (ratio < targetRatio) hi = mid;
    else lo = mid;
  }
  return hslToHex(h, s, (lo + hi) / 2);
}

// level: 1-4. Memoized since the full input space is tiny (3 platform hues
// x 4 levels = 12 combinations, ever) - no reason to re-run 4 binary
// searches worth of math on every cell, every render.
const lightTierCache = new Map();
export function getLightModeTierColor(baseHex, level) {
  const key = `${baseHex}-${level}`;
  if (lightTierCache.has(key)) return lightTierCache.get(key);

  // Re-derive dark theme's own target ratio for this tier/hue combo, rather
  // than a hardcoded number - if the dark-mode opacity curve above is ever
  // tuned, light mode and the OG image stay in sync automatically.
  const targetRatio = contrastRatio(blend(baseHex, DARK_CANVAS, DARK_OPACITIES[level - 1]), DARK_CANVAS);
  const result = darkenToContrast(baseHex, LIGHT_CANVAS, targetRatio);

  lightTierCache.set(key, result);
  return result;
}
