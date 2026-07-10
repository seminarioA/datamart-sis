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
        glass: 'hsl(var(--glass))',
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
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 4px)',
        sm:   'calc(var(--radius) - 8px)',
        xl:   'calc(var(--radius) + 4px)',
        '2xl':'calc(var(--radius) + 8px)',
        '3xl':'calc(var(--radius) + 16px)',
      },
      fontFamily: {
        sans:    ["'Signika'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ["'Montserrat'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '32px',
      },
      boxShadow: {
        glass:   '0 8px 32px 0 rgba(91,111,179,.12)',
        'glass-dark': '0 8px 32px 0 rgba(0,0,0,.35)',
        island:  '0 4px 24px rgba(91,111,179,.10), 0 1px 4px rgba(0,0,0,.06)',
        'island-hover': '0 8px 32px rgba(91,111,179,.18), 0 2px 8px rgba(0,0,0,.08)',
        kpi:     '0 2px 12px rgba(91,111,179,.08)',
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
        'slide-down': {
          from: { maxHeight: '0', opacity: '0' },
          to:   { maxHeight: '200px', opacity: '1' },
        },
        spin:  { to: { transform: 'rotate(360deg)' } },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.4' } },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-slide-up': 'fade-slide-up .28s cubic-bezier(.22,.68,0,1.2) both',
        'fade-in':       'fade-in .25s ease both',
        'slide-down':    'slide-down .22s ease both',
        'spin-slow':     'spin .7s linear infinite',
        pulse:           'pulse 1.4s ease-in-out infinite',
        float:           'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
