import { useEffect, useRef, useState } from 'react';
import './CategoryToggle.css';

export default function CategoryToggle({ options, value, onChange }) {
  const containerRef = useRef(null);
  const [sliderStyle, setSliderStyle] = useState({ left: '0px', width: '0px', opacity: 0 });

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const activeButton = container.querySelector('.category-toggle-btn.active');
      if (activeButton) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeButton.getBoundingClientRect();
        setSliderStyle({
          left: `${activeRect.left - containerRect.left}px`,
          width: `${activeRect.width}px`,
          opacity: 1,
        });
      }
    };

    measure();

    // Use ResizeObserver for robust layout measurement when fonts load or DOM changes
    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [value, options]);

  return (
    <div className="category-toggle" ref={containerRef}>
      <div
        className="category-toggle-slider"
        style={{
          width: sliderStyle.width,
          transform: `translateX(${sliderStyle.left})`,
          opacity: sliderStyle.opacity,
        }}
      />
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`category-toggle-btn ${option.value === value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          <span className="toggle-label">{option.label}</span>
          <span className="toggle-label-short">{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
