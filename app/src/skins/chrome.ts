// Skin par défaut, le seul proposé à l'utilisateur pour l'instant.
import type { Skin } from './types';

export const chrome: Skin = {
  bg: '#0A0B0F', surface: '#111318', surface2: '#1B1E25', sheet: '#121419',
  text: '#EEF0F4', text2: '#A3AAB6', text3: '#8A919E', text4: '#7A818E',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.14)', ghost: 'rgba(255,255,255,0.045)',
  accent: '#FF6A13', accentGlow: 'rgba(255,106,19,0.45)', onKnob: '#141822',
  knob: 'radial-gradient(circle at 34% 28%,#FFFFFF 0%,#D9DEE6 26%,#9098A8 62%,#4B5262 100%)',
  lcd: '#39FF6A', lcdGlow: 'rgba(57,255,106,0.55)',
  glass: 'linear-gradient(180deg,#06080B 0%,#0B0E12 100%)', glassBase: '#080A0E',
  glassHi: 'rgba(255,255,255,0.07)', glassIn: 'rgba(0,0,0,0.7)', track: 'rgba(255,255,255,0.1)',
  rim: 'linear-gradient(180deg,#F4F6F9 0%,#A3ABB8 30%,#3E4450 52%,#8E96A4 75%,#D6DAE1 100%)',
  brand: 'linear-gradient(180deg,#FFFFFF 0%,#DCE1E9 42%,#7A8394 56%,#EEF1F5 100%)',
  seg: 'linear-gradient(0deg,#39FF6A 0%,#39FF6A 60%,#3FE6FF 60%,#3FE6FF 84%,#FF6A13 84%)',
  dotOff: '#3A404C', labelBg: 'rgba(10,11,15,0.82)', shadow: 'rgba(0,0,0,0.55)', pin: '#FF3B3B',
  tints: ['#F5C542', '#FF6B9A', '#A98BFF', '#5CC8FF'],
  onAccent: '#140A04', knobShade: 'rgba(0,0,0,0.3)', switchOff: '#60666F',
  thumb: 'radial-gradient(circle at 35% 30%,#FFFFFF 0%,#C9CED7 70%)',
  scrim: 'rgba(0,0,0,0.55)', statusBar: 'light',
};
