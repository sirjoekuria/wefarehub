'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) {
    return <span className={`inline-block h-9 w-9 ${className}`} />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`icon-button relative !h-9 !w-9 rounded-xl border border-slate-200/80 bg-white/80 p-0 text-slate-700 shadow-xs hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-amber-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 ${className}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun size={17} className="transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon size={17} className="transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
