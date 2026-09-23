import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#03070D',
        'bg-elevated': '#07111F',
        'bg-elevated-2': '#0B1728',
        surface: 'rgba(8, 18, 32, 0.78)',
        'surface-strong': 'rgba(12, 28, 48, 0.9)',
        border: 'rgba(0, 191, 255, 0.22)',
        'border-strong': 'rgba(0, 217, 255, 0.55)',
        ink: '#F5F8FC',
        muted: '#B8C4D2',
        faint: '#718096',
        accent: '#008CFF',
        'accent-bright': '#00D9FF',
        'accent-soft': 'rgba(0, 191, 255, 0.16)',
        'brand-cyan': '#00BFFF',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      borderRadius: {
        control: '8px',
        card: '10px',
        panel: '14px',
      },
      keyframes: {
        'ticker-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'ticker-scroll': 'ticker-scroll 24s linear infinite',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #00D9FF 0%, #008CFF 100%)',
      },
    },
  },
  plugins: [],
}

export default config
