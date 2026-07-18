import { useEffect, useRef, useState } from 'react';

export function useReveal(options = {}) {
  const { triggerOnce = true, threshold = 0.15, rootMargin = '0px' } = options;
  const [revealed, setRevealed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setRevealed(true);
        if (triggerOnce) {
          observer.unobserve(entry.target);
        }
      } else if (!triggerOnce) {
        setRevealed(false);
      }
    }, { threshold, rootMargin });

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [triggerOnce, threshold, rootMargin]);

  return [ref, revealed];
}

export default useReveal;
