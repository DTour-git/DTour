// Broadsheet design tokens — mirrors design_handoff_dtour/tokens/broadsheet.css.
// The web app uses the CSS variables directly; React Native imports these values.

export const colors = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: '#201e1d',
  accent: '#0088b0',
  accent2: '#d6006c',
  processYellow: '#edbb00',
  divider: 'rgba(32,30,29,0.16)',   // color-mix(#201e1d 16%)
  rule: 'rgba(32,30,29,0.08)',      // row separators, color-mix(text 8%)
  scrim: 'rgba(45,43,43,0.45)',

  neutral100: '#f8f4f4', neutral200: '#eae7e7', neutral300: '#d7d3d3', neutral400: '#bab6b6',
  neutral500: '#9b9797', neutral600: '#7d7979', neutral700: '#605d5d', neutral800: '#444141',
  neutral900: '#2d2b2b',

  accent100: '#e9f8ff', accent200: '#cbeeff', accent300: '#99e0ff', accent400: '#62c5ee',
  accent500: '#38a6cf', accent600: '#1186ac', accent700: '#006786', accent800: '#004961',
  accent900: '#0a303e',

  accent2_100: '#fff1f4', accent2_200: '#ffdee6', accent2_300: '#ffc0d0', accent2_400: '#ff90b1',
  accent2_500: '#ff458e', accent2_600: '#d82071', accent2_700: '#aa0b56', accent2_800: '#790e3d',
  accent2_900: '#4b1528',
} as const;

export const radius = { sm: 1, md: 2, lg: 4 } as const;
export const space = { 1: 5, 2: 10, 3: 15, 4: 20, 6: 30, 8: 40 } as const;

export const fonts = {
  regular: 'SourceSerif4_400Regular',
  italic: 'SourceSerif4_400Regular_Italic',
  semibold: 'SourceSerif4_600SemiBold',
} as const;

/** Category / board tone → colours used for rules, tiles and numerals. */
export type Tone = 'accent' | 'accent2' | 'ink';
export const tone = {
  accent:  { main: colors.accent,  tint: colors.accent100,   strong: colors.accent700,   heading: colors.accent800 },
  accent2: { main: colors.accent2, tint: colors.accent2_100, strong: colors.accent2_700, heading: colors.accent2_800 },
  ink:     { main: colors.text,    tint: colors.surface,     strong: colors.text,        heading: colors.text },
} as const;

/** Avatar tints used across the prototypes. */
export type Tint = 'accent' | 'accent2' | 'neutral' | 'accent-light';
export const tint: Record<Tint, { bg: string; fg: string }> = {
  accent: { bg: colors.accent200, fg: colors.accent800 },
  accent2: { bg: colors.accent2_200, fg: colors.accent2_800 },
  neutral: { bg: colors.neutral200, fg: colors.text },
  'accent-light': { bg: colors.accent100, fg: colors.accent800 },
};

/** Tag variants (.tag-accent, .tag-accent-2, .tag-neutral). */
export const tagTone = {
  accent: { bg: colors.accent100, fg: colors.accent800 },
  accent2: { bg: colors.accent2_100, fg: colors.accent2_800 },
  neutral: { bg: colors.neutral100, fg: colors.neutral800 },
} as const;
export type TagTone = keyof typeof tagTone;
