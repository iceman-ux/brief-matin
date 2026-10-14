// Montre à cristaux liquides : écran gris-vert, chiffres sombres.
import type { Skin } from './types';

export const casio: Skin = {
  bg: '#0C0D0B', surface: '#151613', surface2: '#1F201C', sheet: '#141512',
  text: '#ECEDE4', text2: '#AEB0A3', text3: '#92958A', text4: '#83867B',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.15)', ghost: 'rgba(255,255,255,0.045)',
  accent: '#F2762E', accentGlow: 'rgba(242,118,46,0.4)', onKnob: '#F2E9DC',
  knob: 'radial-gradient(circle at 34% 28%,#5A5C55 0%,#2E2F2A 38%,#141512 100%)',
  lcd: '#1C2414', lcdGlow: 'transparent',
  glass: 'linear-gradient(180deg,#BFCBA8 0%,#A7B58F 100%)', glassBase: '#B2BF9B',
  glassHi: 'rgba(255,255,255,0.4)', glassIn: 'rgba(0,0,0,0.22)', track: 'rgba(28,36,20,0.22)',
  rim: 'linear-gradient(180deg,#5E605A 0%,#2A2B27 40%,#0E0F0C 60%,#3C3E39 100%)',
  brand: 'linear-gradient(180deg,#F2762E,#F2762E)',
  seg: 'linear-gradient(0deg,#1C2414,#1C2414)',
  dotOff: 'rgba(28,36,20,0.35)', labelBg: 'rgba(12,13,11,0.86)', shadow: 'rgba(0,0,0,0.55)', pin: '#E63946',
  tints: ['#E9C46A', '#FF7EA8', '#B39DFF', '#6CC6E8', '#4FD1C5', '#E0CBA8'],
  onAccent: '#140A04', knobShade: 'rgba(0,0,0,0.3)', switchOff: '#696C61',
  thumb: 'radial-gradient(circle at 35% 30%,#FFFFFF 0%,#C9CBC0 70%)',
  scrim: 'rgba(0,0,0,0.55)', statusBar: 'light', grain: 0.45,
};
