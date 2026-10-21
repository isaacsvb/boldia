/**
 * BOLD AI — Design system.
 * Dark, premium aesthetic. All spacing on an 8pt grid for intuitive rhythm.
 */

export const colors = {
  // Base surfaces
  bg: '#0B0B12',
  surface: '#14141F',
  surfaceElevated: '#1C1C2B',
  border: '#2A2A3C',

  // Brand
  primary: '#6C5CE7', // electric violet
  primaryDark: '#5346C4',
  accent: '#00D2A8', // mint

  // Text
  text: '#F4F4F8',
  textMuted: '#9A9AB0',
  textFaint: '#5C5C72',

  // Phonetic score color-coding (A -> F)
  scoreGreen: '#2ECC71', // >= 85  strong
  scoreYellow: '#F1C40F', // 70-84 wobbly
  scoreRed: '#E74C3C', // < 70   needs work

  // Feedback
  success: '#2ECC71',
  warning: '#F1C40F',
  danger: '#E74C3C',
  streak: '#FF8A3D', // flame orange
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '600' as const },
  mono: { fontSize: 15, fontWeight: '600' as const },
} as const;

/** Pick the right color-code for a phoneme / word score (0-100). */
export function scoreColor(score: number): string {
  if (score >= 85) return colors.scoreGreen;
  if (score >= 70) return colors.scoreYellow;
  return colors.scoreRed;
}

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};
