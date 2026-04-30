/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy ink scale — kept intact so existing components don't shift.
        // Migrate to surface/hairline/text-* tokens below as components are
        // touched in the design refresh.
        ink: {
          50: '#f5f5f5',
          100: '#e5e5e5',
          200: '#cfcfcf',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#171717',
          900: '#0a0a0a',
          950: '#050505',
        },

        // ─── Refresh tokens (system-wide redesign) ─────────────────────────
        // Page bg stays #050505 (ink-950). New named layers above:
        surface: {
          1: '#0e0e0f', // cards, info panels, sheet
          2: '#16161a', // pills, inputs, nested chips
        },
        hairline: '#26262a', // 1px borders — replaces ad-hoc ink-700/800 borders

        // Text tiers — primary uses ink-50, secondary uses ink-300 (close enough).
        // tertiary is new — a touch lighter than ink-500 to sit comfortably on
        // surface-1 without disappearing.
        tertiary: '#6b6b6b',

        warning: '#f4b860',
        danger: '#e26d5a',

        accent: {
          DEFAULT: '#a3e635', // lime — single accent
          muted: '#5c7a1f', // active-but-not-CTA states (e.g. selected non-primary)
          soft: '#d9f99d', // tints, low-emphasis lime washes
        },
      },
      fontFamily: {
        // Inter for body / UI / numerals (tabular-nums utility for ₹ amounts).
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Fraunces for display headings, screen titles, item names.
        // Italic variant available for editorial section headers.
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Refresh radii — additive, doesn't touch Tailwind defaults.
        card: '14px', // ItemCard, StatTile, MetadataPill containers
        sheet: '22px', // BottomSheet top corners
      },
    },
  },
  plugins: [],
}
