/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // VitaShelf Design System — Flat Design
      // Primary: #2563EB | CTA: #F97316 | BG: #F8FAFC | Text: #1E293B
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
        },
        accent: {
          DEFAULT: '#F97316',
          50:  '#FFF7ED',
          100: '#FFEDD5',
          500: '#F97316',
          600: '#EA580C',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        },
        ink: {
          DEFAULT: '#1E293B',
          muted: '#64748B',
          faint: '#94A3B8',
        },
        // Semantic status colors
        status: {
          ok:      '#22C55E',
          warn:    '#F59E0B',
          danger:  '#EF4444',
          expired: '#DC2626',
        },
      },
      fontFamily: {
        heading: ['"Fira Code"', 'monospace'],
        body:    ['"Fira Sans"', 'sans-serif'],
        sans:    ['"Fira Sans"', 'sans-serif'],
        mono:    ['"Fira Code"', 'monospace'],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      // Flat Design: minimal shadows
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.08)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08)',
        modal: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '150ms',
        normal: '200ms',
      },
    },
  },
  plugins: [],
}
