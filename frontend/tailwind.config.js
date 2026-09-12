/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f6f7fb',
        ink: {
          900: '#0b1020',
          700: '#1e2537',
          500: '#4b5468',
          300: '#8b93a7',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 16, 32, 0.04), 0 8px 24px -12px rgba(11, 16, 32, 0.18)',
        lift: '0 2px 4px rgba(11, 16, 32, 0.05), 0 18px 40px -16px rgba(11, 16, 32, 0.28)',
        glow: '0 0 0 1px rgba(99, 102, 241, 0.18), 0 20px 50px -20px rgba(79, 70, 229, 0.55)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        /* Three drifts at different periods so the background never visibly
           repeats a pattern the eye can lock onto. */
        'drift-slow': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(40px, 30px, 0) scale(1.08)' },
        },
        'drift-medium': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '50%': { transform: 'translate3d(-50px, 20px, 0) scale(1)' },
        },
        'drift-fast': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(30px, -40px, 0) scale(1.12)' },
        },
        'sweep': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        /* Reads its destination from a custom property, so one keyframe
           serves every bar without a per-value class. */
        'fill-bar': {
          from: { width: '0%' },
          to: { width: 'var(--target-w)' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.55', transform: 'scale(0.92)' },
          '70%, 100%': { opacity: '0', transform: 'scale(1.35)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'drift-slow': 'drift-slow 26s ease-in-out infinite',
        'drift-medium': 'drift-medium 32s ease-in-out infinite',
        'drift-fast': 'drift-fast 21s ease-in-out infinite',
        sweep: 'sweep 6s linear infinite',
        'fill-bar': 'fill-bar 800ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },
    },
  },
  plugins: [],
}
