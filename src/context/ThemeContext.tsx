import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Read the persisted theme synchronously so the first render already has the
// correct value.  This avoids the one-frame flash of the wrong theme AND
// eliminates the need to block children behind a `mounted` flag.
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // localStorage unavailable (SSR, private mode restrictions, etc.)
  }
  return 'light';
}

function applyThemeToDom(newTheme: Theme) {
  const root = document.documentElement;
  if (newTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem('theme', newTheme);
  } catch {
    // ignore write failures
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Bug fix: initialise from localStorage synchronously so the very first
  // render already reflects the saved preference.  The old code used
  // `useState('light')` and then updated in a useEffect, which caused:
  //   1. A visible flash of the wrong theme.
  //   2. The `mounted && children` guard to suppress ALL children until the
  //      effect fired, which unmounted then remounted CampaignProvider
  //      (and its nested hooks) on every page load.
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply to DOM on mount (synchronises class with the state-initialised value)
  // and whenever theme changes via setTheme / toggleTheme.
  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Memoize the context value to prevent unnecessary consumer re-renders.
  const value = useMemo<ThemeContextType>(() => ({
    theme,
    isDarkMode: theme === 'dark',
    toggleTheme,
    setTheme,
  }), [theme, toggleTheme, setTheme]);

  // Bug fix: removed `{mounted && children}` — the `mounted` flag was used to
  // wait for the localStorage read, but that read is now synchronous (done in
  // the useState initialiser above).  Gating children on `mounted` caused
  // CampaignProvider and all its hooks to unmount + remount on every load,
  // triggering a second IndexedDB fetch and resetting all hook state.
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
