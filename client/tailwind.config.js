/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wave: {
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      screens: {
        'xs': '375px',
      },
    }
  },
  plugins: []
}
