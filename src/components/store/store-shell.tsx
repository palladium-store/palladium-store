import { koruBody, koruDisplay, koruMono } from './koru/fonts';

/**
 * Wraps a whole area of the site (storefront or admin) in the KORU look: the palette and type in koru.css.
 * `className` adds an area-specific modifier, e.g. `theme-admin`.
 */
export function StoreShell({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`theme-koru ${className} ${koruDisplay.variable} ${koruBody.variable} ${koruMono.variable}`}>{children}</div>;
}
