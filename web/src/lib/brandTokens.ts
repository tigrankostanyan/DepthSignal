/**
 * MyScreener Brand Identity System Tokens (V1.0)
 * Precision is the visual language · Intelligence, made visible.
 */

export const BRAND = {
  name: 'MyScreener',
  tagline: 'Precision is the visual language',
  headline: 'Intelligence, made visible.',
  values: ['Precision', 'Intelligence', 'Data', 'Trading', 'Analytics', 'Trust'],

  colors: {
    midnight: '#071522',       // Preferred dark background
    deepNavy: '#0B1E33',       // Secondary dark ground
    deepBlue: '#173D9A',       // Primary gradient start
    royalBlue: '#2455C3',      // Primary gradient step 2
    electricBlue: '#168FD6',   // Primary brand accent / interactive
    cyan: '#24C4E8',           // Primary brand highlight
    lightCyan: '#BCEFFF',      // Gradient accent endpoint
    ink: '#0B1724',            // Wordmark & text on light
    cloud: '#F4F7FA',          // Light mode surface / background
    white: '#FFFFFF',          // Monochrome white
    black: '#000000',          // Monochrome black
  },

  gradients: {
    // 42° vector: Deep Blue -> Royal Blue -> Electric Blue -> Cyan -> Light Cyan
    primary: 'linear-gradient(42deg, #173D9A 0%, #2455C3 28%, #168FD6 61%, #24C4E8 86%, #BCEFFF 100%)',
    primaryDepth: 'linear-gradient(42deg, #173D9A 0%, #2455C3 25%, #168FD6 50%, #24C4E8 75%, #BCEFFF 100%)',
    accentGlow: 'linear-gradient(135deg, rgba(22, 143, 214, 0.2) 0%, rgba(36, 196, 232, 0.05) 100%)',
    darkSurface: 'linear-gradient(180deg, #0B1E33 0%, #071522 100%)',
  },

  typography: {
    fontFamily: 'var(--font-manrope), "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    weights: {
      regular: 400,     // Body copy and product content
      medium: 500,      // Navigation and UI labels
      semibold: 600,    // Logo and primary display
    },
  },

  spacing: {
    clearspaceRatio: 1 / 6,   // Clearspace >= 1/6 symbol width on every side
    horizontalLockupGapRatio: 0.15, // Gap approx 0.15 * symbol width
    minSymbolSizePx: 16,
    minLockupWidthPx: 140,
  },

  assets: {
    horizontalOnDark: '/brand/myscreener-horizontal-on-dark.svg',
    horizontalOnLight: '/brand/myscreener-horizontal-on-light.svg',
    stackedOnDark: '/brand/myscreener-stacked-on-dark.svg',
    stackedOnLight: '/brand/myscreener-stacked-on-light.svg',
    symbolDepth: '/brand/myscreener-symbol-gradient-depth.svg',
    symbolResponsive: '/brand/myscreener-symbol-gradient-responsive.svg',
    symbolWhite: '/brand/myscreener-symbol-white.svg',
    symbolBlue: '/brand/myscreener-symbol-blue.svg',
    symbolBlack: '/brand/myscreener-symbol-black.svg',
    wordmarkWhite: '/brand/myscreener-wordmark-white.svg',
    wordmarkInk: '/brand/myscreener-wordmark-ink.svg',
    icon16: '/brand/myscreener-icon-16.png',
    icon32: '/brand/myscreener-icon-32.png',
    icon48: '/brand/myscreener-icon-48.png',
    icon64: '/brand/myscreener-icon-64.png',
    icon128: '/brand/myscreener-icon-128.png',
    icon256: '/brand/myscreener-icon-256.png',
  },
} as const;
