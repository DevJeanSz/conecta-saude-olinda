export default {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#0B60C9',
          dark: '#0847AA',
          light: '#DFF0FF',
        },
        secondary: {
          DEFAULT: '#048C47',
          dark: '#03723A',
        },
        accent: {
          DEFAULT: '#4CAF50',
        },
        ita: {
          background: '#F7FBFF',
          red: '#D51F2A',
          yellow: '#FFCF22',
        },
        background: '#F7FBFF',
        cards: '#FFFFFF',
      },
      borderRadius: {
        xl: '12px',
      },
      boxShadow: {
        soft: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [],
};
