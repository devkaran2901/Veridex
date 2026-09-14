/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bauhaus: {
          cream: '#f4f1ea',
          sand: '#eae6df',
          red: '#e63946',
          darkred: '#d9381e',
          blue: '#2563eb',
          cobalt: '#1d4ed8',
          yellow: '#fbbf24',
          gold: '#f59e0b',
          black: '#1c1917',
          charcoal: '#27272a',
          white: '#ffffff',
          muted: '#dcd7cc',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderWidth: {
        '2': '2px',
        '3': '3px',
      },
      boxShadow: {
        'bauhaus': '4px 4px 0px 0px #1c1917',
        'bauhaus-red': '4px 4px 0px 0px #e63946',
        'bauhaus-blue': '4px 4px 0px 0px #2563eb',
      }
    },
  },
  plugins: [],
}
