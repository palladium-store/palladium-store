import { koruBody, koruDisplay, koruMono } from './koru/fonts';

/** Wraps the whole storefront (chrome, page, cart drawer and modals) in the KORU look: the palette and type in koru.css. The admin stays outside it. */
export function StoreShell({ children }: { children: React.ReactNode }) {
  return <div className={`theme-koru ${koruDisplay.variable} ${koruBody.variable} ${koruMono.variable}`}>{children}</div>;
}
