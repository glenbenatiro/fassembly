/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm paper & ink palette
        paper: {
          DEFAULT: '#F4EDE0', // app background (warm ivory)
          raised: '#FBF6EC', // cards, header, inputs
        },
        ink: {
          DEFAULT: '#2B2722', // primary text (warm espresso)
          soft: '#6F665B', // secondary text / labels
          faint: '#9A9086', // hints, timestamps
        },
        line: '#E4DAC8', // hairline borders / dividers
        pine: {
          DEFAULT: '#2F5D50', // primary accent
          bright: '#3C7264', // hover
          deep: '#244A40', // pressed / strong accent text
          wash: '#E8EFE9', // active/selected tint, focus ring
        },
        amber: {
          DEFAULT: '#B07A1E', // warning
          wash: '#F6ECD6',
        },
        brick: {
          DEFAULT: '#9B3A2E', // error
          wash: '#F6E4DE',
        },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        sans: [
          '"Hanken Grotesk Variable"',
          '"Hanken Grotesk"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,39,34,0.04), 0 10px 30px -16px rgba(43,39,34,0.14)',
        lift: '0 2px 4px rgba(43,39,34,0.06), 0 18px 40px -20px rgba(43,39,34,0.22)',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(47,93,80,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(47,93,80,0)' },
        },
        'draw-check': {
          '0%': { strokeDashoffset: '32' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.4s ease-out both',
        breathe: 'breathe 2s ease-in-out infinite',
        'draw-check': 'draw-check 0.5s ease-out 0.15s both',
      },
    },
  },
  plugins: [],
};
