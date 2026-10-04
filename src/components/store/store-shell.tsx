'use client';
import { usePathname } from 'next/navigation';
import { koruBody, koruDisplay, koruMono } from './koru/fonts';

/** Routes that wear the KORU look (dark canvas, red accent). Every other storefront page keeps the light theme. */
export const isKoruRoute = (pathname: string | null) => pathname === '/' || pathname === '/shop';
export const useKoruRoute = () => isKoruRoute(usePathname());

/** Wraps the storefront chrome and page so the palette in koru.css applies to the header, the page and the footer together. */
export function StoreShell({ children }: { children: React.ReactNode }) {
  const koru = useKoruRoute();
  return <div className={koru ? `theme-koru ${koruDisplay.variable} ${koruBody.variable} ${koruMono.variable}` : undefined}>{children}</div>;
}
