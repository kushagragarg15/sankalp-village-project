/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // The blackboard. Only the nav rail and the live module are inverted.
        board: {
          DEFAULT: '#17211F',
          700: '#1E2B28',
          600: '#2A3A35',
          500: '#3E524C',
          400: '#5C716A',
        },
        // Chalk-grey ground.
        paper: {
          DEFAULT: '#F1F2EE',
          deep: '#E6E8E2',
        },
        surface: '#FFFFFF',
        rule: {
          DEFAULT: '#DCDFD8',
          strong: '#C5CAC2',
        },
        ink: {
          DEFAULT: '#17211F',
          2: '#56605C',
          3: '#79837E',
        },
        // Club gold — live state only.
        gold: {
          DEFAULT: '#B8791B',
          deep: '#8A5A0F',
          bright: '#E9A83A',
          wash: '#FBF2E0',
          line: '#E8D3A6',
        },
        teal: {
          DEFAULT: '#1E6B5E',
          wash: '#E7F0ED',
          line: '#BCD5CE',
        },
        brick: {
          DEFAULT: '#A32C24',
          wash: '#FAEBE9',
          line: '#EACBC7',
        },
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '5px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      letterSpacing: {
        display: '-0.02em',
        code: '0.16em',
      },
      keyframes: {
        'rule-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'drawer-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'lift-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Hero-scale entrance, reserved for one-time page arrivals (e.g. the
        // login screen) — a longer, gentler cousin of lift-in's small-UI pop.
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // A mark landing — used for the single gold tick on the login screen,
        // the same "this is live/true" dot used in Badge and LiveCode.
        'mark-in': {
          from: { opacity: '0', transform: 'scale(0.4)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        // A rule drawing itself downward from a mark, echoing the app's
        // chronological spine. Pair with `origin-top`.
        'grow-down': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'rule-pulse': 'rule-pulse 1.6s ease-in-out infinite',
        'drawer-in': 'drawer-in 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'lift-in': 'lift-in 160ms ease-out',
        'rise-in': 'rise-in 640ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'mark-in': 'mark-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'grow-down': 'grow-down 600ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
