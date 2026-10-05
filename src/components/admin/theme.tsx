'use client';
import { createContext, useContext } from 'react';
import { ADMIN_THEME_COOKIE } from './theme-cookie';

/**
 * Admin dark/light theme. The choice is kept in a cookie so the server renders the right theme on the first paint (no flash).
 * Dark is the KORU look and the default; light is `.admin-light` in koru.css.
 */
export type AdminTheme = 'dark' | 'light';

export const AdminThemeContext = createContext<{ theme: AdminTheme; toggle: () => void }>({ theme: 'dark', toggle: () => {} });
export const useAdminTheme = () => useContext(AdminThemeContext);

export function saveAdminTheme(t: AdminTheme) {
  document.cookie = `${ADMIN_THEME_COOKIE}=${t}; path=/admin; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useAdminTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}
      className={`h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-mute transition hover:border-ink/40 hover:text-ink ${className || 'flex'}`}>
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" />
        </svg>
      )}
    </button>
  );
}

/** Text version for the dark sidebar on phones, where the top bar has no room for another button. */
export function ThemeMenuItem({ className = '' }: { className?: string }) {
  const { theme, toggle } = useAdminTheme();
  return (
    <button type="button" onClick={toggle} className={`k-mono whitespace-nowrap text-[11px] uppercase tracking-[0.14em] text-white/50 transition hover:text-white ${className}`}>
      {theme === 'dark' ? 'Light theme' : 'Dark theme'}
    </button>
  );
}
