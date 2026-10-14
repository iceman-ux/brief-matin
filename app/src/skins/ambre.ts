// Afficheur fluorescent ambré, cuivre et bois sombre.
import type { Skin } from './types';

export const ambre: Skin = {
  bg: '#0B0806', surface: '#16100B', surface2: '#22180F', sheet: '#150F0A',
  text: '#F6E7D2', text2: '#CDB394', text3: '#B0946F', text4: '#9C8262',
  line: 'rgba(255,200,140,0.08)', line2: 'rgba(255,200,140,0.16)', ghost: 'rgba(255,200,140,0.05)',
  accent: '#FFB000', accentGlow: 'rgba(255,176,0,0.4)', onKnob: '#1A1006',
  knob: 'radial-gradient(circle at 34% 28%,#FFE9C7 0%,#D8A866 30%,#8A5A26 66%,#3D260F 100%)',
  lcd: '#FFB000', lcdGlow: 'rgba(255,176,0,0.55)',
  glass: 'linear-gradient(180deg,#070402 0%,#0D0805 100%)', glassBase: '#0A0604',
  glassHi: 'rgba(255,200,140,0.06)', glassIn: 'rgba(0,0,0,0.7)', track: 'rgba(255,176,0,0.16)',
  rim: 'linear-gradient(180deg,#F3D9B1 0%,#B98A52 30%,#4A2F14 52%,#A57B47 75%,#E9CBA0 100%)',
  brand: 'linear-gradient(180deg,#FFE9C7 0%,#D49A4E 55%,#FFE3B8 100%)',
  seg: 'linear-gradient(0deg,#FFB000 0%,#FFB000 70%,#FF6A13 70%)',
  dotOff: '#4A3826', labelBg: 'rgba(11,8,6,0.86)', shadow: 'rgba(0,0,0,0.55)', pin: '#FF4D3D',
  tints: ['#FFD166', '#FF7E9F', '#B39DFF', '#7FD1FF', '#5ED6C8', '#E8D2B0'],
  onAccent: '#1A1006', knobShade: 'rgba(0,0,0,0.3)', switchOff: '#76624C',
  thumb: 'radial-gradient(circle at 35% 30%,#FFF4E3 0%,#D8BE98 70%)',
  scrim: 'rgba(0,0,0,0.55)', statusBar: 'light', grain: 0.5,
};
