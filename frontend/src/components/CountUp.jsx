import { useEffect, useState, useRef } from 'react';

export default function CountUp({ value, duration = 450 }) {
  const [count, setCount] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    if (start === end) return;

    prevValueRef.current = end;
    const startTime = performance.now();

    let animationFrameId;

    const updateCount = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Easing: easeOutQuad
      const ease = progress * (2 - progress);
      const nextCount = Math.round(start + (end - start) * ease);
      setCount(nextCount);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <span>{count}</span>;
}
