// --- Theme-equal intensity math ---------------------------------------
// Duplicated from frontend/src/utils/platformColors.js (getLightModeTierColor /
// getDarkModeTierColor) rather than shared, since this is a separate
// CommonJS backend with no shared module boundary with the Vite frontend.
// Keep both in sync if either the platform hues or TIER_FRACTIONS curve
// ever changes.
//
// See that file's comment block for the full rationale: target ratios are
// defined directly on a shared curve (TIER_FRACTIONS) anchored to each hue's
// own contrast against black, then solved as a solid HSL-darkened shade
// hitting that exact ratio against THIS image's near-white canvas. This
// image only ever renders on a light canvas, so it only needs the
// light-mode half of that math (no dark-canvas / lightenToContrast side).
const OG_CANVAS = '#F2EDED'; // matches the OG image's own background
const OG_DARK_REFERENCE_CANVAS = '#000000';
// Same curve as frontend's TIER_FRACTIONS - keep numerically identical.
const OG_TIER_FRACTIONS = [0.35, 0.55, 0.8, 1];

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
function darkenToContrast(baseHex, bgHex, targetRatio) {
  const [h, s] = hexToHsl(baseHex);
  // Full [0,1] range, not capped at the base hue's own lightness: contrast
  // against a near-white bg falls monotonically as l rises from 0 (black)
  // to 1 (white) across the WHOLE range, regardless of where the base hue
  // itself sits. Capping the search at the base hue assumed every tier
  // needs darkening, but a hue that's already fairly dark (codeforces blue)
  // can overshoot an early tier's target before any darkening at all -
  // early tiers there need to search *lighter* than the base hue instead,
  // or two adjacent tiers collapse into the identical color.
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
// Builds the 4-tier ramp (level 1-4) for one platform hue, each tier hitting
// a target ratio on the shared TIER_FRACTIONS curve, anchored to baseHex's
// own contrast against black (see comment block above).
function buildTierRamp(baseHex) {
  const fullRatio = contrastRatio(baseHex, OG_DARK_REFERENCE_CANVAS);
  return OG_TIER_FRACTIONS.map((fraction) => {
    const targetRatio = 1 + (fullRatio - 1) * fraction;
    return darkenToContrast(baseHex, OG_CANVAS, targetRatio);
  });
}

// Computed once at module load, not per-request - inputs are fixed hexes,
// there's nothing request-specific to recompute.
const RAMPS = {
  github: buildTierRamp('#39d353'),
  codeforces: buildTierRamp('#4a90d9'),
  leetcode: buildTierRamp('#ffa116'),
};

module.exports = { RAMPS, OG_CANVAS };
