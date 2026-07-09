/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        sis: {
          navy:   '#5b6fb3',
          navy2:  '#4a5fa0',
          navy3:  '#7a8ed0',
          accent: '#dc388d',
          green:  '#afcc46',
          orange: '#f6a64a',
          blue:   '#57c4f2',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ["'Signika'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ["'Montserrat'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.99)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        'slide-down': {
          from: { maxHeight: '0', opacity: '0' },
          to:   { maxHeight: '200px', opacity: '1' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
        pulse: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '.4' },
        },
      },
      animation: {
        'fade-slide-up': 'fade-slide-up .28s cubic-bezier(.22,.68,0,1.2) both',
        'fade-in':       'fade-in .25s ease both',
        'slide-down':    'slide-down .22s ease both',
        'spin-slow':     'spin .7s linear infinite',
        pulse:           'pulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
