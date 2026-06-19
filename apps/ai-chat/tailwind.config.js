/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ai: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          accent: '#38bdf8',
          text: '#f1f5f9',
          muted: '#94a3b8',
          user: '#3b82f6',
          agent: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};