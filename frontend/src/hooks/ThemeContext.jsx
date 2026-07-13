import { createContext, useContext, useEffect, useState } from 'react';

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

  const toggleTheme = () => {
    setThemeState(activeTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
