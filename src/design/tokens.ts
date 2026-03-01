export const colors = {
  base:     '#060608',
  surface0: '#0d0d10',
  surface1: '#131318',
  surface2: '#1a1a22',
  border:   'rgba(255,255,255,0.03)',
  borderLit:'rgba(255,255,255,0.08)',

  purple:   '#9945FF',
  purpleDim:'rgba(153,69,255,0.25)',
  green:    '#14F195',
  greenDim: 'rgba(20,241,149,0.12)',
  ghost:    '#00FF88',
  ghostDim: 'rgba(0,255,136,0.08)',

  gold:     '#FFD700',
  silver:   '#B8C5D6',
  bronze:   '#D4845A',

  error:    '#FF3B5C',
  warning:  '#FF9F0A',

  text:     '#F0F0F8',
  textSub:  '#6B6B80',
  textMute: '#2E2E3A',
};

export const space = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 };

export const type = {
  amountHero:  { fontFamily: 'JetBrainsMono-Bold',   fontSize: 48, letterSpacing: -2 },
  amountLarge: { fontFamily: 'JetBrainsMono-Bold',   fontSize: 32, letterSpacing: -1 },
  amountSmall: { fontFamily: 'JetBrainsMono-Regular', fontSize: 16 },
  address:     { fontFamily: 'JetBrainsMono-Regular', fontSize: 11, letterSpacing: 0.5 },
  label:       { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, fontWeight: '700' as const },
  body:        { fontSize: 15, lineHeight: 22 },
  caption:     { fontSize: 12, lineHeight: 18 },
};
