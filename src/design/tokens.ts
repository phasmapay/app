export const colors = {
  // Light theme backgrounds
  base:     '#F8F7FC',
  surface0: '#FFFFFF',
  surface1: '#F1EFF8',
  surface2: '#E8E5F0',
  border:   'rgba(0,0,0,0.06)',
  borderLit:'rgba(0,0,0,0.10)',

  // Phasma purple gradient (from logo)
  purple:   '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark: '#6D28D9',
  purpleDim:'rgba(139,92,246,0.12)',

  // Functional
  green:    '#10B981',
  greenDim: 'rgba(16,185,129,0.10)',
  ghost:    '#00C853',
  ghostDim: 'rgba(0,200,83,0.08)',

  // Tier colors
  gold:     '#F59E0B',
  silver:   '#6B7280',
  bronze:   '#D97706',

  error:    '#EF4444',
  warning:  '#F59E0B',

  // Text on light
  text:     '#1A1A2E',
  textSub:  '#6B7280',
  textMute: '#9CA3AF',
};

export const space = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 };

export const type = {
  amountHero:  { fontSize: 42, fontWeight: '800' as const, letterSpacing: -1.5 },
  amountLarge: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -1 },
  amountSmall: { fontSize: 16, fontWeight: '500' as const },
  address:     { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
  label:       { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, fontWeight: '700' as const },
  body:        { fontSize: 15, lineHeight: 22 },
  caption:     { fontSize: 12, lineHeight: 18 },
};
