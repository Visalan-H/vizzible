import { cloneElement, memo, useEffect, useMemo, useRef } from 'react';
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

function Heatmap({ values, color = '#39d353', onDayClick, startDate, endDate, highlightMonth, onMonthClick, platform }) {
  const max = useMemo(() => Math.max(1, ...values.map((v) => v.count)), [values]);
  const { theme } = useTheme();
  const containerRef = useRef(null);
  // Mouse-driven devices get hover-to-preview (matches how the month
  // highlight and every other desktop affordance here works); touch
  // devices get tap-to-select instead, since there's no hover state to
  // read on a phone and a stray touchmove shouldn't be treated as a hover.
  const hoverCapable = useHoverCapable();

  // Detect if light mode is currently active
  const isLight = theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  const interactionProps = hoverCapable
    ? { onMouseOver: (_event, value) => value && onDayClick?.(value) }
    : { onClick: (value) => value && onDayClick?.(value) };

  // react-calendar-heatmap renders its own month labels (correctly spaced
  // proportional to each month's actual week-columns - Feb is narrower than
  // Jan, etc), but doesn't expose a per-label onClick prop. Rather than
  // duplicate them with a second, misaligned row of buttons, click
  // delegation on the container catches clicks on the library's own
  // <text class="react-calendar-heatmap-month-label"> elements directly.
  function handleContainerClick(event) {
    if (!event.target.classList.contains('react-calendar-heatmap-month-label')) return;
    const month = MONTH_INDEX[event.target.textContent];
    if (month != null) onMonthClick?.(month);
  }

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
      <div className="heatmap-scroll-inner" ref={containerRef} onClick={handleContainerClick}>
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

            return cloneElement(element, { style: { fill: displayColor, fillOpacity }, 'data-date': value?.date });
          }}
        />
      </div>
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
