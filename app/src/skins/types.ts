// Clés d'un skin : couleurs et matières seulement. La mise en page, les
// tailles et les polices ne changent jamais d'un skin à l'autre (theme.ts).
//
// Sens des couleurs, dans chaque skin :
// - accent : les actions (play, bouton principal, réveil, interrupteurs ON,
//   progression), rien d'autre ;
// - lcd : les écrans (heure, temps, spectre), rien d'autre ;
// - tints : les sujets 1 à 4, jamais une action.
//
// Les dégradés (knob, glass, rim, brand, seg, thumb) sont écrits en CSS,
// recopiés des maquettes ; gradient.ts les traduit pour React Native.

export type SkinName = 'chrome' | 'casio' | 'ambre' | 'papier';

export type Skin = {
  bg: string;
  surface: string;
  surface2: string;
  sheet: string;
  text: string;
  text2: string;
  text3: string;
  text4: string;
  line: string;
  line2: string;
  ghost: string;
  accent: string;
  accentGlow: string;
  onKnob: string;
  knob: string;
  lcd: string;
  lcdGlow: string;
  glass: string;
  glassBase: string;
  glassHi: string;
  glassIn: string;
  track: string;
  rim: string;
  brand: string;
  seg: string;
  dotOff: string;
  labelBg: string;
  shadow: string;
  pin: string;
  tints: [string, string, string, string];
  // Clés ajoutées à la spec V11 : couleurs que les maquettes écrivaient en dur.
  /** Texte du bouton plein « Activer le réveil ». */
  onAccent: string;
  /** Ombre intérieure du bas des boutons ronds. */
  knobShade: string;
  /** Interrupteur OFF : contraste ≥ 3:1 avec `surface`. */
  switchOff: string;
  /** Pastille des interrupteurs. */
  thumb: string;
  /** Voile sous les feuilles. */
  scrim: string;
  /** Texte de la barre d'état iOS. */
  statusBar: 'light' | 'dark';
};
