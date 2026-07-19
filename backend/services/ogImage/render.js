const React = require('react');
const { RAMPS } = require('./colorRamp');

// @vercel/og's ImageResponse is Satori + resvg under the hood, not raw SVG
// + a bare @resvg/resvg-js call like an earlier version of this used. Every
// attempt to hand a custom font to resvg directly - reading .woff2 from
// node_modules/@fontsource/..., a vercel.json includeFiles glob, a plain
// committed backend/fonts/ folder, even a base64 string embedded straight
// in JS source - still rendered blank text in production despite every one
// of those working locally, which stopped looking like a "file didn't get
// bundled" problem and started looking like something more fundamental
// about how that font data was reaching resvg on Vercel's specific
// runtime. @vercel/og sidesteps the whole question: it ships its own Noto
// Sans font built into the npm package itself (not a loose asset needing
// separate bundling), so no custom font handling is needed here at all.
//
// @vercel/og ships as an ES Module (dist/index.node.js), and this backend
// is CommonJS (require()) - a plain top-level require('@vercel/og') throws
// ERR_REQUIRE_ESM at runtime, since CJS can't load ESM synchronously.
// Loaded via dynamic import() instead (the fix Node's own error message
// points to), cached in a module-level promise so a warm function instance
// only pays that import cost once, not once per request.
let ImageResponseCtorPromise = null;
function getImageResponseCtor() {
  if (!ImageResponseCtorPromise) {
    ImageResponseCtorPromise = import('@vercel/og').then((mod) => mod.ImageResponse);
  }
  return ImageResponseCtorPromise;
}

const e = React.createElement;

// Satori (the engine behind ImageResponse) requires any element with more
// than one child to declare display: 'flex', even when every child is
// taken out of flow via position: 'absolute' for exact pixel placement -
// that's why it shows up on every multi-child node below, not just the
// ones actually using flex layout for something.
const abs = (extra) => ({ position: 'absolute', display: 'flex', ...extra });

function statBlock(x, value, label) {
  return e(
    'div',
    { key: `stat-${x}`, style: abs({ left: x, top: 165, width: 260, flexDirection: 'column', alignItems: 'center' }) },
    e('div', { key: 'v', style: { display: 'flex', fontSize: 36, fontWeight: 800, color: '#000000' } }, String(value)),
    e('div', { key: 'l', style: { display: 'flex', fontSize: 15, fontWeight: 600, color: '#555555', letterSpacing: 0.5, marginTop: 4 } }, label)
  );
}

function platformKey(x, color, label) {
  return e(
    'div',
    { key: `pk-${x}`, style: abs({ left: x, top: 548, alignItems: 'center' }) },
    e('div', { key: 'sw', style: { display: 'flex', width: 16, height: 16, borderRadius: 3, background: color, marginRight: 10 } }),
    e('div', { key: 'lb', style: { display: 'flex', fontSize: 15, fontWeight: 700, color: '#555555' } }, label)
  );
}

// Builds the React element tree for one profile's OG image. All inputs are
// plain data - no DB access or fetches happen in here, so this stays easy
// to reason about independently of how the data was gathered (see
// ogImage/index.js for that part).
function buildOGImageElement({
  avatarDataUrl,
  username,
  taglineStr,
  currentStreak,
  longestStreak,
  totalSubmissions,
  activeDaysCount,
  monthLabels,
  cells,
}) {
  return e(
    'div',
    { style: { width: 1200, height: 630, display: 'flex', position: 'relative', background: '#F2EDED', border: '4px solid #000000' } },
    // Avatar ring + image
    e('div', { key: 'ring', style: abs({ left: 41, top: 33, width: 84, height: 84, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.15)' }) }),
    e('img', { key: 'avatar', src: avatarDataUrl, width: 84, height: 84, style: abs({ left: 41, top: 33, width: 84, height: 84, borderRadius: '50%' }) }),
    // Username + tagline
    e('div', { key: 'username', style: abs({ left: 145, top: 38, fontSize: 40, fontWeight: 800, color: '#000000' }) }, username),
    e('div', { key: 'tagline', style: abs({ left: 145, top: 88, fontSize: 22, fontWeight: 500, color: '#333333' }) }, taglineStr),
    // Stat dividers
    e('div', { key: 'div1', style: abs({ left: 320, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
    e('div', { key: 'div2', style: abs({ left: 600, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
    e('div', { key: 'div3', style: abs({ left: 880, top: 170, width: 1.5, height: 60, background: 'rgba(0,0,0,0.15)' }) }),
    // Stats
    statBlock(40, currentStreak, 'CURRENT STREAK'),
    statBlock(320, longestStreak, 'LONGEST STREAK'),
    statBlock(600, totalSubmissions, 'TOTAL ACTIVITY'),
    statBlock(880, activeDaysCount, 'ACTIVE DAYS'),
    // Month labels
    ...monthLabels.map((m, i) => e('div', { key: `month-${i}`, style: abs({ left: m.x, top: 298, fontSize: 14, color: '#666666', fontWeight: 500 }) }, m.text)),
    // Heatmap cells
    ...cells.map((c, i) => e('div', { key: `cell-${i}`, style: abs({ left: c.x, top: c.y, width: 21, height: 21, borderRadius: 3.5, background: c.fillColor }) })),
    // Legend: Less [empty][4 github tiers] More
    e('div', { key: 'less', style: abs({ left: 40, top: 548, fontSize: 14, fontWeight: 600, color: '#666666' }) }, 'Less'),
    e('div', { key: 'sw0', style: abs({ left: 95, top: 545, width: 22, height: 22, borderRadius: 3.5, background: 'rgba(0,0,0,0.05)' }) }),
    e('div', { key: 'sw1', style: abs({ left: 123, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[0] }) }),
    e('div', { key: 'sw2', style: abs({ left: 151, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[1] }) }),
    e('div', { key: 'sw3', style: abs({ left: 179, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[2] }) }),
    e('div', { key: 'sw4', style: abs({ left: 207, top: 545, width: 22, height: 22, borderRadius: 3.5, background: RAMPS.github[3] }) }),
    e('div', { key: 'more', style: abs({ left: 242, top: 548, fontSize: 14, fontWeight: 600, color: '#666666' }) }, 'More'),
    // Platform key
    platformKey(760, RAMPS.github[3], 'GitHub'),
    platformKey(870, RAMPS.codeforces[3], 'Codeforces'),
    platformKey(1016, RAMPS.leetcode[3], 'LeetCode'),
    // Brand
    e('div', { key: 'brand', style: abs({ right: 40, top: 40, fontSize: 26, fontWeight: 800, color: '#000000' }) }, 'vizzible.vercel.app')
  );
}

module.exports = { buildOGImageElement, getImageResponseCtor };
