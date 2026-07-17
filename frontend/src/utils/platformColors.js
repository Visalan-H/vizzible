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
// Both themes render a level 1-4 day as a SOLID shade of the platform's hue
// (no opacity involved), each solved by binary search on HSL lightness to
// hit a target WCAG 2.0 contrast ratio against that theme's own canvas.
//
// Previously dark theme used opacity (25/50/75/100%) over black instead of
// solving for a ratio directly, and light theme reverse-derived its target
// ratio from that opacity curve. That looked fine at level 4 (solid raw hue
// either way), but low opacity over a BLACK canvas crushes luminance almost
// to zero - e.g. 25% github-green over black lands at luminance ~0.03,
// which is indistinguishable from the canvas at a glance even though its
// contrast *ratio* is "correct". Near white the same ratio lands at a much
// higher, clearly-visible luminance, so low levels looked fine in light
// mode and nearly invisible in dark mode - same ratio, opposite outcome,
// because WCAG ratio isn't perceptually uniform near either extreme.
//
// Fix: define target ratios directly, on a shared curve (TIER_FRACTIONS),
// anchored to the raw hue's own contrast against BLACK (every platform hue
// here is designed to look good on black - see PLATFORM_COLORS - so that's
// the natural ceiling). Both themes solve for a solid color at that exact
// ratio against their own canvas: dark theme searches from black outward
// (ratio rises with lightness), light theme searches from the light canvas
// inward (ratio falls with lightness). A "level 3" day ends up an
// identical target ratio, and thus comparable visible weight, in either
// theme, without opacity's tendency to crush chroma near black.
const LIGHT_CANVAS = '#F2EDED';
const DARK_CANVAS = '#000000';
// How far each level climbs from ratio 1 (indistinguishable from canvas)
// to the raw hue's full natural ratio against black. Floor raised from the
// old opacity curve's implicit 0.25 to 0.35 so level 1 stays visible
// instead of nearly disappearing into a black canvas.
const TIER_FRACTIONS = [0.35, 0.55, 0.8, 1];

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

// Mirror image of darkenToContrast for a canvas darker than any candidate
// color (i.e. near-black): contrast ratio there RISES as lightness rises
// (there's no headroom below the canvas, so every candidate is the "lighter"
// side of the ratio), the opposite relationship from a near-white canvas.
// Using darkenToContrast's hi/lo direction against a black canvas would
// converge to the wrong end of the range.
function lightenToContrast(baseHex, bgHex, targetRatio) {
  const [h, s] = hexToHsl(baseHex);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const ratio = contrastRatio(hslToHex(h, s, mid), bgHex);
    if (ratio < targetRatio) lo = mid;
    else hi = mid;
  }
  return hslToHex(h, s, (lo + hi) / 2);
}

// Shared by both getters below: the ratio a given level should hit, on the
// curve anchored to baseHex's own natural contrast against black.
function targetRatioFor(baseHex, level) {
  const fullRatio = contrastRatio(baseHex, DARK_CANVAS);
  return 1 + (fullRatio - 1) * TIER_FRACTIONS[level - 1];
}

// level: 1-4. Memoized since the full input space is tiny (3 platform hues
// x 4 levels = 12 combinations, ever) - no reason to re-run 4 binary
// searches worth of math on every cell, every render.
const lightTierCache = new Map();
export function getLightModeTierColor(baseHex, level) {
  const key = `${baseHex}-${level}`;
  if (lightTierCache.has(key)) return lightTierCache.get(key);

  const result = darkenToContrast(baseHex, LIGHT_CANVAS, targetRatioFor(baseHex, level));

  lightTierCache.set(key, result);
  return result;
}

const darkTierCache = new Map();
export function getDarkModeTierColor(baseHex, level) {
  const key = `${baseHex}-${level}`;
  if (darkTierCache.has(key)) return darkTierCache.get(key);

  const result = lightenToContrast(baseHex, DARK_CANVAS, targetRatioFor(baseHex, level));

  darkTierCache.set(key, result);
  return result;
}
