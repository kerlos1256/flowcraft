'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.theme = next ? 'dark' : 'light';
    } catch {
      /* ignore */
    }
  }

  return (
    <button className="btn btn-sm" onClick={toggle} aria-label="Toggle theme">
      {dark ? '☀︎' : '☾'}
    </button>
  );
}
