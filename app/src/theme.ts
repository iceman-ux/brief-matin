// Toute l'apparence de l'app est ici : couleurs, polices, tailles, espacements,
// arrondis. Les écrans n'en contiennent aucune ; l'illustration est à part,
// dans Illustration.tsx. Changer de direction artistique, c'est réécrire ces
// deux fichiers.
//
// DA actuelle : Art déco des années 30, nocturne. Valeurs relevées sur les
// maquettes validées (Claude outputs/maquettes-app, écran de 390 × 844).
import { BodoniModa_400Regular_Italic } from '@expo-google-fonts/bodoni-moda/400Regular_Italic';
import { JosefinSans_400Regular } from '@expo-google-fonts/josefin-sans/400Regular';
import { JosefinSans_600SemiBold } from '@expo-google-fonts/josefin-sans/600SemiBold';
import { Limelight_400Regular } from '@expo-google-fonts/limelight/400Regular';
import type { TextStyle } from 'react-native';

export const colors = {
  background: '#0B0E2A',
  card: '#11153A',
  cardBright: '#1B2466',
  accent: '#F2A33A',
  // Texte posé sur l'accent (boutons pleins, jours cochés).
  onAccent: '#0B0E2A',
  ornament: '#C9953C',
  deep: '#8E1426',
  text: '#F4EBDD',
  textMuted: '#B9B3CC',
  frame: 'rgba(201,149,60,0.45)',
  border: 'rgba(201,149,60,0.3)',
  divider: 'rgba(201,149,60,0.18)',
  listDivider: 'rgba(201,149,60,0.2)',
  track: 'rgba(201,149,60,0.25)',
  dayOff: 'rgba(201,149,60,0.35)',
  stepper: 'rgba(201,149,60,0.5)',
  badge: 'rgba(11,14,42,0.55)',
  transparent: 'transparent',
};

// Une famille par graisse : React Native ne synthétise pas le gras d'une
// police chargée, il faut nommer le fichier voulu.
export const fonts = {
  display: 'Limelight_400Regular',
  ui: 'JosefinSans_400Regular',
  uiBold: 'JosefinSans_600SemiBold',
  quote: 'BodoniModa_400Regular_Italic',
};

/** Fichiers chargés au démarrage par expo-font, sous les noms de `fonts`. */
export const fontFiles = {
  Limelight_400Regular,
  JosefinSans_400Regular,
  JosefinSans_600SemiBold,
  BodoniModa_400Regular_Italic,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  s: 6,
  dayGap: 7,
  m: 8,
  ml: 10,
  l: 12,
  xl: 18,
  xxl: 20,
  section: 22,
  skipGap: 30,
};

export const radii = {
  check: 4,
  badge: 12,
  day: 12,
  tile: 14,
  group: 18,
  panel: 20,
  card: 24,
  cover: 28,
  round: 999,
};

export const sizes = {
  touch: 44,
  stepper: 48,
  dayWidth: 40,
  primaryButton: 56,
  cardButton: 54,
  skipButton: 52,
  playButton: 80,
  playIcon: 28,
  cardPlayIcon: 18,
  icon: 22,
  settingsIcon: 20,
  row: 56,
  listRow: 48,
  topicRow: 40,
  tile: 48,
  checkbox: 22,
  progress: 4,
  thumb: 14,
  diamond: 8,
  hairline: 1,
  illustrationHero: 330,
  illustrationCard: 168,
  illustrationCover: 300,
  // Les maquettes sont dessinées pour 390 px de large : dans un navigateur de
  // bureau, l'app garde une largeur de téléphone au lieu de s'étirer.
  maxAppWidth: 430,
  noticeMaxWidth: 300,
  timeMinWidth: 170,
};

// Marges des écrans ; le haut inclut la barre d'état, comme sur les maquettes.
export const layout = {
  gutter: 24,
  welcomeGutter: 28,
  homeTop: 60,
  screenTop: 56,
  bottom: 28,
  bottomLoose: 32,
  cardPaddingH: 20,
  cardPaddingV: 18,
  rowPaddingH: 18,
  backOffset: -12,
  badgeTop: 16,
  coverTitleTop: 36,
};

const overline = (fontSize: number, letterSpacing: number): TextStyle => ({
  fontFamily: fonts.uiBold,
  fontSize,
  letterSpacing,
  color: colors.ornament,
});

/** Styles de texte nommés par usage ; les écrans n'utilisent que ceux-ci. */
export const type = {
  brandOverline: overline(11, 3.5),
  overline: overline(11, 3),
  overlineLarge: overline(12, 3),
  logoHero: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, color: colors.accent },
  logoHeader: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44, color: colors.accent },
  logoCover: { fontFamily: fonts.display, fontSize: 56, lineHeight: 56, color: colors.text },
  logoFooter: { fontFamily: fonts.display, fontSize: 20, color: colors.ornament },
  pageTitle: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
  timeHero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 56, color: colors.text },
  timeCard: { fontFamily: fonts.display, fontSize: 52, lineHeight: 52, color: colors.text },
  timeRow: { fontFamily: fonts.display, fontSize: 24, color: colors.accent },
  tagline: { fontFamily: fonts.quote, fontSize: 19, color: colors.text },
  hook: { fontFamily: fonts.quote, fontSize: 21, lineHeight: 27, color: colors.text },
  quote: { fontFamily: fonts.quote, fontSize: 22, color: colors.text },
  episodeMeta: { fontFamily: fonts.uiBold, fontSize: 14, letterSpacing: 1.5, color: colors.ornament },
  badge: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 3, color: colors.text },
  body: { fontFamily: fonts.ui, fontSize: 16, color: colors.text },
  bodyMuted: { fontFamily: fonts.ui, fontSize: 16, color: colors.textMuted },
  value: { fontFamily: fonts.ui, fontSize: 15, color: colors.textMuted },
  meta: { fontFamily: fonts.ui, fontSize: 14, color: colors.textMuted },
  clock: { fontFamily: fonts.ui, fontSize: 13, color: colors.textMuted },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  link: { fontFamily: fonts.uiBold, fontSize: 15, letterSpacing: 1, color: colors.accent },
  button: { fontFamily: fonts.uiBold, fontSize: 17, letterSpacing: 1, color: colors.onAccent },
  skip: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.text },
  stepper: { fontFamily: fonts.ui, fontSize: 24, lineHeight: 28, color: colors.text },
  day: { fontFamily: fonts.uiBold, fontSize: 16 },
  tile: { fontFamily: fonts.ui, fontSize: 15, color: colors.text },
} satisfies Record<string, TextStyle>;
