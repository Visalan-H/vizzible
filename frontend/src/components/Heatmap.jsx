import { cloneElement } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import { useTheme } from '../hooks/ThemeContext';
import 'react-calendar-heatmap/dist/styles.css';
import './Heatmap.css';

function intensity(count, max) {
  if (!count) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export default function Heatmap({ values, color = '#39d353', onDayClick, startDate, endDate }) {
  const max = Math.max(1, ...values.map((v) => v.count));
  const { theme } = useTheme();

  // Detect if light mode is currently active
  const isLight = theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="heatmap-scroll-container">
      <div className="heatmap-scroll-inner">
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={values}
          onClick={(value) => onDayClick?.(value)}
          classForValue={(value) => `color-scale-${intensity(value?.count, max)}`}
          transformDayElement={(element, value) => {
            const level = intensity(value?.count, max);
            
            // Adjust opacity scale for light theme to maintain high-contrast visibility
            let fillOpacity;
            if (level === 0) {
              fillOpacity = isLight ? 0.05 : 0.08;
            } else {
              fillOpacity = isLight 
                ? 0.35 + (level - 1) * 0.21 // 0.35, 0.56, 0.77, 0.98
                : level / 4;                // 0.25, 0.50, 0.75, 1.00
            }

            return cloneElement(element, { style: { fill: color, fillOpacity } });
          }}
          titleForValue={(value) => (value ? `${value.date}: ${value.count} activity - click for details` : '')}
        />
      </div>
    </div>
  );
}
