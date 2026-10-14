// Ce qui ne change pas d'un skin à l'autre : polices, tailles, espacements,
// rayons. Les couleurs et les matières sont dans src/skins/.
//
// Valeurs relevées sur les maquettes V11 (Claude outputs/maquettes-app-v11,
// écran de 390 × 844) et sur spec-design-v11.md.
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';
import { Michroma_400Regular } from '@expo-google-fonts/michroma/400Regular';
import { SchibstedGrotesk_400Regular } from '@expo-google-fonts/schibsted-grotesk/400Regular';
import { SchibstedGrotesk_600SemiBold } from '@expo-google-fonts/schibsted-grotesk/600SemiBold';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk/700Bold';
import { SchibstedGrotesk_800ExtraBold } from '@expo-google-fonts/schibsted-grotesk/800ExtraBold';
import type { TextStyle } from 'react-native';

// Une famille par graisse : React Native ne synthétise pas le gras d'une
// police chargée, il faut nommer le fichier voulu.
export const fonts = {
  text: 'SchibstedGrotesk_400Regular',
  textSemi: 'SchibstedGrotesk_600SemiBold',
  textBold: 'SchibstedGrotesk_700Bold',
  textHeavy: 'SchibstedGrotesk_800ExtraBold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  brand: 'Michroma_400Regular',
  lcd: 'DSEG7Classic-Bold',
};

/** Fichiers chargés au démarrage par expo-font, sous les noms de `fonts`. */
export const fontFiles = {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
  GeistMono_400Regular,
  GeistMono_500Medium,
  Michroma_400Regular,
  // Paquet npm dseg, licence OFL.
  'DSEG7Classic-Bold': require('dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.ttf'),
};

export const spacing = {
  xxs: 2,
  xs: 4,
  s: 6,
  m: 8,
  ml: 10,
  l: 12,
  xl: 14,
  xxl: 16,
  row: 18,
  block: 20,
  section: 24,
  sectionLoose: 32,
  group: 36,
};

export const radii = {
  label: 8,
  day: 14,
  chip: 16,
  card: 20,
  glass: 22.5,
  device: 24,
  sheet: 28,
  handle: 3,
  round: 999,
};

export const sizes = {
  touch: 44,
  mark: 32,
  hairline: 1,
  rimWidth: 1.5,
  knobHome: 64,
  knobPlayer: 82,
  knobWake: 104,
  // Anneau du bouton play : 2 px de fond puis 2 px d'accent.
  knobGap: 2,
  knobRing: 4,
  stepper: 48,
  control: 54,
  chip: 58,
  chipBar: 2,
  primary: 58,
  wakeButton: 52,
  dot: 7,
  dotLegend: 8,
  dotRing: 2,
  progress: 2,
  progressBlock: 16,
  switchWidth: 52,
  switchHeight: 32,
  switchThumb: 26,
  switchInset: 3,
  handleWidth: 36,
  handleHeight: 5,
  activeBar: 3,
  iconSmall: 11,
  icon: 16,
  iconMedium: 17,
  iconPlay: 24,
  iconPlayLarge: 28,
  iconPlayWake: 34,
  bell: 14,
  mapHeight: 196,
  trendHeight: 64,
  globe: 240,
  spectrumHome: { width: 64, height: 36, bars: 11 },
  spectrumPlayer: { height: 28, bars: 28 },
  // Spectre : segments de 2 px pleins, 1 px vide.
  segment: 2,
  segmentGap: 1,
  // Les maquettes sont dessinées pour 390 px de large : dans un navigateur de
  // bureau, l'app garde une largeur de téléphone au lieu de s'étirer.
  maxAppWidth: 430,
  numberColumn: 24,
};

export const layout = {
  gutter: 20,
  // Sans zone sûre connue (navigateur), on garde la place d'une barre d'état.
  minTopInset: 44,
  top: 10,
  bottom: 28,
  deviceHome: { top: 16, right: 16, bottom: 14, left: 20 },
  devicePlayer: { vertical: 18, horizontal: 20 },
  sheetTop: 10,
  sheetBottom: 40,
  cardPadding: 18,
  labelPad: { vertical: 4, horizontal: 9 },
  pillPadding: 16,
  rowPad: { vertical: 12, right: 16, left: 18 },
  sheetHeightRatio: 0.62,
};

// Le titre d'écran est lettré à −2,5 % de sa taille, l'étiquette à +6 %, le
// logo à +28 %.
const tracking = (size: number, ratio: number) => size * ratio;

/** Styles de texte nommés par usage ; la couleur vient toujours du skin. */
export const type = {
  screenTitle: { fontFamily: fonts.textHeavy, fontSize: 38, lineHeight: 39, letterSpacing: tracking(38, -0.025) },
  topicTitle: { fontFamily: fonts.textHeavy, fontSize: 28, lineHeight: 31, letterSpacing: tracking(28, -0.025) },
  sheetTitle: { fontFamily: fonts.textHeavy, fontSize: 32, lineHeight: 34, letterSpacing: tracking(32, -0.025) },
  date: { fontFamily: fonts.textSemi, fontSize: 18, letterSpacing: tracking(18, -0.01) },
  barTitle: { fontFamily: fonts.textSemi, fontSize: 16 },
  body: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.textSemi, fontSize: 16 },
  value: { fontFamily: fonts.text, fontSize: 15 },
  row: { fontFamily: fonts.text, fontSize: 15, lineHeight: 20 },
  rowActive: { fontFamily: fonts.textSemi, fontSize: 15, lineHeight: 20 },
  list: { fontFamily: fonts.text, fontSize: 14 },
  hint: { fontFamily: fonts.text, fontSize: 14 },
  about: { fontFamily: fonts.text, fontSize: 15, lineHeight: 23 },
  button: { fontFamily: fonts.textSemi, fontSize: 15 },
  pill: { fontFamily: fonts.textSemi, fontSize: 14 },
  primary: { fontFamily: fonts.textBold, fontSize: 17 },
  wakeCaption: { fontFamily: fonts.textSemi, fontSize: 16 },
  chipCity: { fontFamily: fonts.textBold, fontSize: 14 },
  day: { fontFamily: fonts.textBold, fontSize: 14 },
  cityLabel: { fontFamily: fonts.textSemi, fontSize: 14 },
  label: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: tracking(12, 0.06), textTransform: 'uppercase' },
  data: { fontFamily: fonts.mono, fontSize: 12 },
  dataLarge: { fontFamily: fonts.monoMedium, fontSize: 14 },
  dataMedium: { fontFamily: fonts.mono, fontSize: 13 },
  stepper: { fontFamily: fonts.text, fontSize: 22 },
  chevron: { fontFamily: fonts.text, fontSize: 18 },
  brand: { fontFamily: fonts.brand, fontSize: 16, letterSpacing: tracking(16, 0.28) },
  brandSmall: { fontFamily: fonts.brand, fontSize: 13, letterSpacing: tracking(13, 0.28) },
  lcdHome: { fontFamily: fonts.lcd, fontSize: 34, lineHeight: 38 },
  lcdPlayer: { fontFamily: fonts.lcd, fontSize: 52, lineHeight: 56 },
  lcdWake: { fontFamily: fonts.lcd, fontSize: 76, lineHeight: 80 },
  lcdSetting: { fontFamily: fonts.lcd, fontSize: 42, lineHeight: 46 },
} satisfies Record<string, TextStyle>;

// Les chiffres LCD et le logo sont des objets dessinés : au-delà de ce
// facteur, Dynamic Type les ferait déborder de leur écran.
export const LCD_MAX_SCALE = 1.2;
