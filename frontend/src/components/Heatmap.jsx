import { cloneElement, memo, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { useTheme } from '../hooks/ThemeContext';
import { useHoverCapable } from '../hooks/useHoverCapable';
import { PLATFORM_COLORS, dominantPlatform, getLightModeTierColor, getDarkModeTierColor } from '../utils/platformColors';
import 'react-calendar-heatmap/dist/styles.css';
import './Heatmap.css';

const MONTH_INDEX = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function intensity(count, max) {
  if (!count) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function monthOf(dateStr) {
  return Number(dateStr.slice(5, 7)) - 1;
}

// Parsed as UTC, same as every other date-string read in this app (see
// utils/streaks.js) - a plain `new Date('YYYY-MM-DD')` would otherwise be
// fine here too (date-only ISO strings are already UTC-parsed per spec),
// but being explicit keeps this consistent with the rest of the codebase.
function formatTooltipDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getDayIndex(dateStr, year) {
  if (!dateStr) return 0;
  const date = new Date(dateStr + 'T00:00:00');
  const start = new Date(year, 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.round(diff / 86400000);
}

function Heatmap({ values, color = '#39d353', onDayClick, startDate, endDate, highlightMonth, onMonthClick, platform }) {
  const max = useMemo(() => Math.max(1, ...values.map((v) => v.count)), [values]);
  const { theme } = useTheme();
  const containerRef = useRef(null);
  // Mouse-driven devices only - a touch device has no hover state to read,
  // and synthetic mouseover events some browsers fire right after a tap
  // would otherwise leave a tooltip stuck open until the next tap
  // elsewhere.
  const hoverCapable = useHoverCapable();
  const [tooltip, setTooltip] = useState(null); // { x, y, date, count } | null

  // Click/tap always selects a day (opens the detail panel below the
  // grid) regardless of device. Hover additionally shows a lightweight
  // tooltip on mouse-driven devices - a preview, not a replacement for the
  // click-to-select detail panel, so it never calls onDayClick itself.
  const interactionProps = {
    onClick: (value) => value && onDayClick?.(value),
    ...(hoverCapable && {
      onMouseOver: (event, value) =>
        value && setTooltip({ x: event.clientX, y: event.clientY, date: value.date, count: value.count }),
      onMouseLeave: () => setTooltip(null),
    }),
  };

  // Detect if light mode is currently active
  const isLight = theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  // react-calendar-heatmap renders its own month labels (correctly spaced
  // proportional to each month's actual week-columns - Feb is narrower than
  // Jan, etc), but doesn't expose a per-label onClick prop. Rather than
  // duplicate them with a second, misaligned row of buttons, a single
  // delegated click/keydown listener pair on the scroll container (below)
  // catches interaction with the library's own
  // <text class="react-calendar-heatmap-month-label"> DOM nodes.

  // Wrapped in useEffectEvent so the delegated-listener effect below can
  // always call the latest onMonthClick without listing it as a dependency
  // - an Effect Event reads current props/state without being reactive, so
  // a parent re-render that hands down a new onMonthClick function
  // identity (e.g. an inline arrow prop) doesn't force that effect to tear
  // down and re-attach its listeners on every render.
  const handleMonthActivate = useEffectEvent((monthIndex) => {
    onMonthClick?.(monthIndex);
  });

  // Owns exactly one click listener and one keydown listener on the
  // container, attached once on mount and released on unmount - cheaper
  // than one pair per label, and its cleanup is a direct, traceable
  // removeEventListener call for each addEventListener call, with no other
  // reactive values captured, so this effect never needs to re-run.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const monthLabelFor = (target) => target.closest?.('.react-calendar-heatmap-month-label');

    const onClick = (event) => {
      const label = monthLabelFor(event.target);
      if (!label) return;
      const monthIndex = MONTH_INDEX[label.textContent];
      if (monthIndex != null) handleMonthActivate(monthIndex);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const label = monthLabelFor(event.target);
      if (!label) return;
      event.preventDefault();
      const monthIndex = MONTH_INDEX[label.textContent];
      if (monthIndex != null) handleMonthActivate(monthIndex);
    };

    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('click', onClick);
      container.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Toggling a CSS class on the real label nodes (rather than trying to
  // thread highlight state through the library's props, which it doesn't
  // support for labels) so the selected month's label visibly matches the
  // dimmed/highlighted cells below it. The library left-aligns every label
  // to where that month's column starts (so does GitHub's own graph) -
  // fine for a static row of labels, but once one month is the visual
  // focus it reads as misaligned. So for just the active label, this also
  // measures the actual rendered x-range of that month's cells (via the
  // week columns' own transform= translate values, not a recomputed date
  // calculation - reading the real DOM avoids any risk of drifting out of
  // sync with however the library itself lays things out) and recenters
  // the label over it. Every other label is left untouched at its default
  // library position.
  useEffect(() => {
    const container = containerRef.current;
    const labels = container?.querySelectorAll('.react-calendar-heatmap-month-label');
    if (!labels) return;

    const year = startDate.getUTCFullYear();

    labels.forEach((label) => {
      const monthIndex = MONTH_INDEX[label.textContent];
      if (monthIndex == null) return;

      const isActive = monthIndex === highlightMonth;
      label.classList.toggle('active', isActive);

      // Keyboard-focusable and announced as a button - the actual
      // click/keydown handling lives in the delegated-listener effect
      // above, so this effect only sets the attributes, no listeners.
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const dayRects = container.querySelectorAll(`rect[data-date^="${year}-${monthStr}-"]`);
      if (dayRects.length === 0) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let squareWidth = 10;
      dayRects.forEach((rect) => {
        const weekGroup = rect.closest('.react-calendar-heatmap-week');
        const match = weekGroup?.getAttribute('transform')?.match(/translate\(([-\d.]+)/);
        const x = match ? parseFloat(match[1]) : 0;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        squareWidth = parseFloat(rect.getAttribute('width')) || squareWidth;
      });

      label.setAttribute('x', (minX + maxX + squareWidth) / 2);
      label.setAttribute('text-anchor', 'middle');
    });
  }, [highlightMonth, values, startDate]);

  return (
    <div className="heatmap-scroll-container">
      <div className="heatmap-scroll-inner" ref={containerRef}>
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={values}
          {...interactionProps}
          classForValue={(value) => `color-scale-${intensity(value?.count, max)}`}
          transformDayElement={(element, value) => {
            const level = intensity(value?.count, max);

            // Both themes render level 1-4 as a solid, level-appropriate
            // shade of the hue (see getLightModeTierColor / getDarkModeTierColor
            // for why opacity over black crushes low levels toward
            // invisible while the same opacity over near-white doesn't).
            // Only idle (level 0) cells still use flat low opacity on the
            // raw color, same as before, in both themes.
            let fillOpacity = level === 0 ? 0.08 : 1;

            // Cells outside the selected month fade out instead of being
            // hidden - keeps the shape of the full year visible for context
            // while making the selected month's cluster obvious at a glance.
            const isDimmed = highlightMonth != null && value && monthOf(value.date) !== highlightMonth;
            if (isDimmed) fillOpacity *= 0.15;

            // In the combined view, a flat single hue across every cell
            // hid which platform actually drove a given day - so instead
            // the cell takes the color of whichever platform contributed
            // the most that day (github/codeforces/leetcode), while opacity
            // keeps reflecting the day's *total* across all platforms (via
            // `level`/`max` above, unchanged). Per-platform tabs keep their
            // single fixed `color` as before - there's no "dominant" to pick
            // between when only one platform's counts are being shown.
            const cellColor =
              platform === 'combined' && value && value.total > 0
                ? PLATFORM_COLORS[dominantPlatform(value)]
                : color;

            // Only tier-shade when there's an actual hue to shade - level 0
            // (idle) cells keep using the raw color at low opacity, same as
            // before, in both themes.
            let displayColor = cellColor;
            if (level > 0) {
              displayColor = isLight ? getLightModeTierColor(cellColor, level) : getDarkModeTierColor(cellColor, level);
            }

            const weekIdx = Math.floor(getDayIndex(value?.date, startDate.getUTCFullYear()) / 7);
            return cloneElement(element, { 
              style: { 
                fill: displayColor, 
                fillOpacity,
                animationDelay: `${weekIdx * 10}ms`
              }, 
              'data-date': value?.date 
            });
          }}
        />
      </div>

      {tooltip && (
        <div className="heatmap-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <span className="heatmap-tooltip-count">
            {tooltip.count || 0} {tooltip.count === 1 ? 'activity' : 'activities'}
          </span>
          <span className="heatmap-tooltip-date">{formatTooltipDate(tooltip.date)}</span>
        </div>
      )}
    </div>
  );
}

// Memoized because this wraps a third-party calendar library and does its
// own DOM measurement in an effect - by far the most expensive component
// in the profile page. Without memo, it fully re-renders (rebuilding the
// whole SVG grid) every time an ancestor re-renders for any reason,
// including things that have nothing to do with the heatmap itself, e.g.
// hovering a single day cell. As long as the props below are given stable
// references by the caller (dates via useMemo, callbacks via useCallback),
// this memo actually skips that work instead of being a no-op.
export default memo(Heatmap);
