/** Maps a variant name like "Pink" or "Blue grip" to a swatch colour; null when the name isn't a known colour. */
const COLORS: Record<string, string> = {
  black: '#111111', white: '#ffffff', grey: '#8a8a8a', gray: '#8a8a8a', silver: '#c0c0c0',
  red: '#d62828', pink: '#f4a6b8', rose: '#e58fa6', orange: '#f77f00', yellow: '#f6d023', gold: '#e6b422',
  green: '#2e9e5b', lime: '#b5e61d', mint: '#9fd9c4', teal: '#2a9d8f', blue: '#1f6feb', navy: '#14213d',
  sky: '#7cc4f0', purple: '#7b3fe4', lavender: '#b9a3e8', brown: '#7a4a2b', beige: '#e3d3b8', cream: '#f5efe0',
};
export function swatchColor(name: string): string | null {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const w of words) if (COLORS[w]) return COLORS[w];
  return null;
}
