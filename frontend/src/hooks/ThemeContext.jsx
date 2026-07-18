import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeState, setThemeState] = useState(() => {
    const stored = localStorage.getItem('theme');
    return (stored === 'light' || stored === 'dark') ? stored : null;
  });

  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    if (themeState !== null) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeState]);

  useEffect(() => {
    if (themeState) {
      localStorage.setItem('theme', themeState);
      document.documentElement.setAttribute('data-theme', themeState);
    } else {
      localStorage.removeItem('theme');
      document.documentElement.removeAttribute('data-theme');
    }
  }, [themeState]);

  const activeTheme = themeState || systemTheme;

  const toggleTheme = useCallback((e) => {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';

    if (!document.startViewTransition) {
      setThemeState(nextTheme);
      return;
    }

    const x = e?.clientX ?? window.innerWidth / 2;
    const y = e?.clientY ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Suppresses every element's own CSS transitions (hundreds of them
    // across heatmap cells, buttons, inputs) for the duration of the view
    // transition - see the .theme-switching rule in index.css for why.
    // Removed once the browser reports the transition has fully finished
    // (not just .ready, which only means the new-state screenshot is
    // captured) so nothing un-suppresses mid-animation.
    document.documentElement.classList.add('theme-switching');

    const transition = document.startViewTransition(() => {
      flushSync(() => {
        setThemeState(nextTheme);
      });
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-switching');
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 400,
          easing: 'ease-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }, [activeTheme]);

  const value = useMemo(() => ({ theme: activeTheme, toggleTheme }), [activeTheme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
