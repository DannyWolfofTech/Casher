import { readPreference, writePreference } from '@/lib/preferences';
import { useEffect, useState } from "react";
import { isIOSApp } from '@/lib/mobile-platform';
import { ThemeContext, type Theme } from "./theme-context";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readPreference("theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    writePreference("theme", theme);
    if (isIOSApp()) {
      let active = true;
      void import('@capacitor/status-bar').then(async ({ StatusBar, Style }) => {
        if (!active) return;
        await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
        if (active) await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#020817' : '#f5f2eb' });
      }).catch(() => { /* Web previews may not have the native plugin. */ });
      return () => { active = false; };
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

