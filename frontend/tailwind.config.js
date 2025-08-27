/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      
      colors: {
        sdaia: {
          green: '#10B981',
          orange: '#F59E0B',
          indigo: '#4338CA',
        },
        border: 'hsl(214.3 31.8% 91.4%)',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
      },

      /* === كل الحركات مجمّعة مرة وحدة === */
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        glowPulse: {
          '0%,100%': { opacity: '0.25', transform: 'scale(1)' },
          '50%':     { opacity: '0.45', transform: 'scale(1.05)' },
        },
        shine: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        tabPop: {
          '0%':   { transform: 'translateY(4px) scale(0.98)', opacity: '0.6' },
          '100%': { transform: 'translateY(0) scale(1)',     opacity: '1'   },
        },
      },
      animation: {
        'fade-up': 'fadeUp .7s ease-out both',
        'glow':    'glowPulse 4s ease-in-out infinite',
        'shine':   'shine 2.2s linear infinite',
        'tab-pop': 'tabPop .22s ease-out both',
      },
    },
  },
  plugins: [],
}
