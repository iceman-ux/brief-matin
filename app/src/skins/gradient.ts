// Les dégradés des skins sont écrits en CSS, comme dans les maquettes, pour
// pouvoir les recopier tels quels. React Native ne lit pas ces chaînes :
// expo-linear-gradient et react-native-svg veulent des arrêts de couleur.

export type GradientStop = { color: string; offset: number };

export type Gradient =
  | { kind: 'linear'; angle: number; stops: GradientStop[] }
  | { kind: 'radial'; cx: number; cy: number; r: number; stops: GradientStop[] };

/** Découpe aux virgules de premier niveau : « rgba(0,0,0,0.3) » reste entier. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const percent = (text: string) => Number(text.replace('%', '')) / 100;

function parseStops(parts: string[]): GradientStop[] {
  const raw = parts.map((part) => {
    const m = part.match(/^(.*?)(?:\s+(-?[\d.]+%))?$/);
    return { color: (m?.[1] ?? part).trim(), offset: m?.[2] ? percent(m[2]) : null };
  });
  // Arrêts sans position : répartis régulièrement entre leurs voisins, comme en CSS.
  if (raw[0].offset === null) raw[0].offset = 0;
  if (raw[raw.length - 1].offset === null) raw[raw.length - 1].offset = 1;
  for (let i = 1; i < raw.length - 1; i++) {
    if (raw[i].offset !== null) continue;
    let j = i;
    while (raw[j].offset === null) j++;
    const from = raw[i - 1].offset as number;
    const to = raw[j].offset as number;
    for (let k = i; k < j; k++) raw[k].offset = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return raw.map((s) => ({ color: s.color, offset: s.offset as number }));
}

export function parseGradient(css: string): Gradient {
  const m = css.trim().match(/^(linear|radial)-gradient\((.*)\)$/s);
  if (!m) return { kind: 'linear', angle: 180, stops: [{ color: css, offset: 0 }, { color: css, offset: 1 }] };
  const parts = splitTopLevel(m[2]);
  if (m[1] === 'linear') {
    const angle = parts[0].match(/^(-?[\d.]+)deg$/);
    return angle
      ? { kind: 'linear', angle: Number(angle[1]), stops: parseStops(parts.slice(1)) }
      : { kind: 'linear', angle: 180, stops: parseStops(parts) };
  }
  const at = parts[0].match(/at\s+([\d.]+)%\s+([\d.]+)%/);
  const cx = at ? Number(at[1]) / 100 : 0.5;
  const cy = at ? Number(at[2]) / 100 : 0.5;
  // « circle » en CSS va jusqu'au coin le plus éloigné du centre.
  const r = Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy));
  return { kind: 'radial', cx, cy, r, stops: parseStops(at ? parts.slice(1) : parts) };
}

/**
 * Points de départ et d'arrivée d'un dégradé linéaire, dans un carré unité.
 * En CSS, 0deg va vers le haut et 180deg vers le bas.
 */
export function linearPoints(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}
