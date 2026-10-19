/** @type {import('tailwindcss').Config} */
// Tailwind compilado en build (reemplaza el CDN en index.html).
// Los colores usan variables CSS en canales RGB para que TODAS las utilidades
// respondan al modo claro/oscuro (ver src/tw.css).
const v = (name) => `rgb(var(--tw-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Superficies (temáticas)
        'surface-base': v('surface-base'),
        'surface-card': v('surface-card'),
        'surface-overlay': v('surface-overlay'),
        'surface-container-lowest': v('surface-container-lowest'),
        'surface-container-low': v('surface-container-low'),
        'surface-container': v('surface-container'),
        'surface-container-high': v('surface-container-high'),
        'surface-container-highest': v('surface-container-highest'),
        deep: v('deep'),
        panel: v('panel'),
        'panel-2': v('panel-2'),
        // Texto (temático)
        'text-primary': v('text-primary'),
        'text-secondary': v('text-secondary'),
        'text-tertiary': v('text-tertiary'),
        'on-surface': v('text-primary'),
        // Marca
        'neon-emerald': v('brand-ink'),
        'primary-container': v('brand'),
        'primary-fixed': v('brand-2'),
        'on-brand': v('on-brand'),
        'tertiary-container': v('brand-2'),
        secondary: v('brand'),
        // Estados
        'status-info': v('info'),
        'status-warning': v('warning'),
        'status-alert': v('alert'),
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
        'electric-mint': '#00FF88',
      },
      borderColor: {
        glass: 'var(--fl-glass)',
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        'space-xxl': '4rem',
        gutter: '1.5rem',
        'gutter-mobile': '1rem',
        margin: '3rem',
        'margin-mobile': '1.25rem',
      },
      fontFamily: {
        'display-hero': ['Sora'], 'display-hero-mobile': ['Sora'],
        'headline-lg': ['Sora'], 'headline-lg-mobile': ['Sora'],
        'headline-md': ['Sora'], 'headline-sm': ['Sora'], 'button-text': ['Sora'],
        'body-lg': ['Outfit'], 'body-md': ['Outfit'], 'body-sm': ['Outfit'],
        'label-mono-sm': ['Space Mono'], 'label-mono-xs': ['Space Mono'],
        headline: ['Sora'], display: ['Sora'], body: ['Outfit'], label: ['Space Mono'],
      },
      fontSize: {
        'display-hero': ['56px', { lineHeight: '64px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-hero-mobile': ['34px', { lineHeight: '42px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['40px', { lineHeight: '48px', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'button-text': ['14px', { lineHeight: '20px', letterSpacing: '0.02em', fontWeight: '600' }],
        'label-mono-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '400' }],
        'label-mono-xs': ['10px', { lineHeight: '14px', letterSpacing: '0.1em', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
