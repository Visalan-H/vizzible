import { useEffect, useState } from 'react';

const QUERY = '(hover: hover) and (pointer: fine)';

// Media-query based rather than screen-width or user-agent based - a
// touchscreen laptop or a desktop-sized tablet would get misclassified by
// either of those. (hover: hover) + (pointer: fine) is the actual signal
// for "this device has a mouse", regardless of screen size.
export function useHoverCapable() {
  const [hoverCapable, setHoverCapable] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setHoverCapable(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return hoverCapable;
}
