import type { Config } from 'tailwindcss';
// Colours are CSS variables (set in globals.css) so a section of the site can wear a different palette: see `.theme-koru` in koru.css.
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: c('ink'), paper: c('paper'), bone: c('bone'), line: c('line'), mute: c('mute'), night: c('night'),
        gold: { DEFAULT: c('gold'), deep: c('gold-deep'), soft: c('gold-soft') },
      },
      fontFamily: { display: ['var(--font-body)', 'system-ui', 'sans-serif'], sans: ['var(--font-body)', 'system-ui', 'sans-serif'] },
      letterSpacing: { tightest: '-0.03em' },
    },
  },
  plugins: [],
} satisfies Config;
