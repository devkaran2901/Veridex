/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          lime: '#ccff00',      // Electric Lime from reference
          coral: '#ff6b5b',     // Vibrant Coral Pink
          yellow: '#ffe600',    // Sunflower Yellow
          purple: '#6a38ff',    // Deep Purple canvas
          darkpurple: '#4c1d95',
          lavender: '#d8b4fe',
          cyan: '#38bdf8',
          bg: '#581c87',
          black: '#000000',
          white: '#ffffff',
          pink: '#f472b6',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px #000000',
        'neo-lg': '6px 6px 0px 0px #000000',
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo-lime': '4px 4px 0px 0px #ccff00',
        'neo-purple': '4px 4px 0px 0px #6a38ff',
      }
    },
  },
  plugins: [],
}
