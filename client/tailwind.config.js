/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f8f9f9',
          'container-lowest': '#ffffff',
          'container-low': '#f3f4f4',
          'container': '#edeeee',
          'container-high': '#e7e8e8',
          'container-highest': '#e1e3e3',
        },
        'on-surface': {
          DEFAULT: '#191c1c',
          variant: '#404943',
        },
        primary: {
          DEFAULT: '#0f5238',
          container: '#2d6a4f',
          fixed: '#b1f0ce',
        },
        'on-primary': {
          DEFAULT: '#ffffff',
          fixed: '#002114',
        },
        secondary: {
          DEFAULT: '#785a00',
          container: '#ffd167',
        },
        'on-secondary': {
          DEFAULT: '#ffffff',
          container: '#765900',
        },
        'outline-variant': '#bfc9c1',
        error: '#ba1a1a',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
};
