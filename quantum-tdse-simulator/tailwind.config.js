/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './index.html',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
    },
    extend: {
      colors: {
        // Text colors
        'text-primary': '#000000',
        'text-secondary': '#333333',
        'text-tertiary': '#666666',
        'text-disabled': '#999999',
        
        // Border colors
        'border-default': '#CCCCCC',
        'border-focus': '#000000',
        
        // Surface colors
        'surface-primary': '#FFFFFF',
        'surface-secondary': '#F5F5F5',
        'surface-tertiary': '#E5E5E5',
        
        // Accent colors
        'accent-primary': '#0057B7',
        'accent-dark': '#003D82',
        
        // Visualization colors
        'viz-real': '#0066CC',
        'viz-imaginary': '#CC0000',
        'viz-probability': '#00AA44',
        'viz-potential': '#666666',
        'viz-grid': '#DDDDDD',
      },
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['SF Mono', 'Roboto Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
      },
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '6': '48px',
        '8': '64px',
        '12': '96px',
      },
      borderRadius: {
        'none': '0px',
        'sm': '2px',
      },
      boxShadow: {
        'none': 'none',
        'minimal': '0 1px 3px rgba(0, 0, 0, 0.12)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '200ms',
      },
      transitionTimingFunction: {
        'default': 'linear',
        'out': 'ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
