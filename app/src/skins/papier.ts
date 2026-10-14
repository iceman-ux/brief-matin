// Skin clair : papier crème, encre noire.
import type { Skin } from './types';

export const papier: Skin = {
  bg: '#F1EDE4', surface: '#FBF9F4', surface2: '#FFFFFF', sheet: '#FBF9F4',
  text: '#15140F', text2: '#47443C', text3: '#5F5B51', text4: '#6B675D',
  line: 'rgba(21,20,15,0.09)', line2: 'rgba(21,20,15,0.18)', ghost: 'rgba(21,20,15,0.04)',
  accent: '#C23A14', accentGlow: 'rgba(194,58,20,0.22)', onKnob: '#15140F',
  knob: 'radial-gradient(circle at 34% 28%,#FFFFFF 0%,#EDE9E0 35%,#BDB7AA 75%,#8F897C 100%)',
  lcd: '#15140F', lcdGlow: 'transparent',
  glass: 'linear-gradient(180deg,#E6E1D5 0%,#DCD6C8 100%)', glassBase: '#E1DBCE',
  glassHi: 'rgba(255,255,255,0.6)', glassIn: 'rgba(0,0,0,0.1)', track: 'rgba(21,20,15,0.14)',
  rim: 'linear-gradient(180deg,#15140F,#15140F)',
  brand: 'linear-gradient(180deg,#15140F,#15140F)',
  seg: 'linear-gradient(0deg,#15140F 0%,#15140F 75%,#C23A14 75%)',
  dotOff: 'rgba(21,20,15,0.25)', labelBg: 'rgba(251,249,244,0.92)', shadow: 'rgba(60,50,30,0.14)', pin: '#D62828',
  tints: ['#8F5E00', '#C2185B', '#5B3CC4', '#0B6E99', '#0F7C74', '#7A5C33'],
  onAccent: '#FFFFFF', knobShade: 'rgba(0,0,0,0.15)', switchOff: '#8A857A',
  thumb: 'radial-gradient(circle at 35% 30%,#FFFFFF 0%,#E4DFD4 70%)',
  scrim: 'rgba(21,20,15,0.45)', statusBar: 'dark', grain: 0.35,
};
