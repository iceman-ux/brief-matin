// Fiche zone : le lieu du sujet, ses sources et sa présence dans la presse.
// Chaque ligne n'apparaît que si sa donnée existe.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { tintOf, useSkin } from '../skins';
import { type Topic, formatCoordinates, localTime, topicNumber, trendDirection } from '../topics';
import { layout, radii, sizes, spacing, type } from '../theme';
import { GhostButton, Label } from '../ui';
import { Sheet } from './Sheet';

// Repère de la courbe, étiré à la largeur de la carte.
const CHART_W = 175;
const CHART_H = 44;
const CHART_PAD = 4;
const AREA_OPACITY = 0.3;
const LINE_WIDTH = 2;

function trendPoints(trend: number[]): string {
  const min = Math.min(...trend);
  const span = Math.max(...trend) - min || 1;
  return trend
    .map((v, i) => {
      const x = (i * CHART_W) / (trend.length - 1);
      const y = CHART_H - CHART_PAD - ((v - min) / span) * (CHART_H - 2 * CHART_PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

type Props = {
  topics: Topic[];
  /** Sujet affiché ; null : fiche fermée. */
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  now: Date;
};

export function TopicSheet({ topics, index, onIndex, onClose, now }: Props) {
  const skin = useSkin();
  const topic = index === null ? null : topics[index];
  const place = topic?.place;
  // ‹ et › ne passent que par les sujets qui ont un lieu : les autres n'ont pas de fiche.
  const withPlace = topics.map((t, i) => (t.place ? i : -1)).filter((i) => i >= 0);
  const step = (delta: number) => {
    if (index === null) return;
    const at = withPlace.indexOf(index);
    onIndex(withPlace[(at + delta + withPlace.length) % withPlace.length]);
  };

  const rows: { key: string; value: ReactNode }[] = [];
  if (topic && place) {
    rows.push({ key: 'Ville', value: place.city });
    const local = localTime(place, now);
    if (local) rows.push({ key: 'Heure locale', value: local });
    if (topic.sources) {
      rows.push({
        key: 'Sources',
        value: `${topic.sources.length} ${topic.sources.length > 1 ? 'médias' : 'média'}\n${topic.sources.join(' · ')}`,
      });
    }
    if (topic.related7d !== undefined) rows.push({ key: 'Sujets liés · 7 j', value: String(topic.related7d) });
  }
  const tint = index === null ? skin.accent : tintOf(skin, index);

  return (
    <Sheet visible={topic !== null && place !== undefined} onClose={onClose} closeLabel="Fermer la fiche">
      {topic && place && index !== null && (
        <>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Label color={tint}>
                Sujet {topicNumber(index)} / {topicNumber(topics.length - 1)}
              </Label>
              <Text style={[type.sheetTitle, { color: skin.text }]} accessibilityRole="header">
                {place.country}
              </Text>
              <Label>{formatCoordinates(place)}</Label>
            </View>
            {withPlace.length > 1 && (
              <View style={styles.arrows}>
                <GhostButton label="Sujet précédent" round={sizes.touch} onPress={() => step(-1)}>
                  <Text style={[type.chevron, { color: skin.text }]}>‹</Text>
                </GhostButton>
                <GhostButton label="Sujet suivant" round={sizes.touch} onPress={() => step(1)}>
                  <Text style={[type.chevron, { color: skin.text }]}>›</Text>
                </GhostButton>
              </View>
            )}
          </View>

          <View style={[styles.card, styles.facts, { backgroundColor: skin.surface, borderColor: skin.line }]}>
            {rows.map((row, i) => (
              <View
                key={row.key}
                accessible
                style={[styles.fact, i > 0 && { borderTopWidth: sizes.hairline, borderTopColor: skin.line }]}
              >
                <Label>{row.key}</Label>
                <Text style={[type.value, styles.factValue, { color: skin.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {topic.trend7d && (
            <View
              accessible
              accessibilityLabel={`Présence dans la presse sur 7 jours : ${
                trendDirection(topic.trend7d) === '▲' ? 'en hausse' : trendDirection(topic.trend7d) === '▼' ? 'en baisse' : 'stable'
              }`}
              style={[styles.card, styles.trend, { backgroundColor: skin.surface, borderColor: skin.line }]}
            >
              <View style={styles.trendHead}>
                <Label>Présence dans la presse · 7 j</Label>
                <Label color={tint}>{trendDirection(topic.trend7d)}</Label>
              </View>
              <Svg width="100%" height={sizes.trendHeight} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`trendArea${index}`} x1={0} y1={0} x2={0} y2={1}>
                    <Stop offset={0} stopColor={tint} stopOpacity={AREA_OPACITY} />
                    <Stop offset={1} stopColor={tint} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Polygon
                  points={`${trendPoints(topic.trend7d)} ${CHART_W},${CHART_H} 0,${CHART_H}`}
                  fill={`url(#trendArea${index})`}
                />
                <Polyline
                  points={trendPoints(topic.trend7d)}
                  fill="none"
                  stroke={tint}
                  strokeWidth={LINE_WIDTH}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </Svg>
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.l },
  headText: { gap: spacing.m, flexShrink: 1 },
  arrows: { flexDirection: 'row', gap: spacing.m },
  card: { borderRadius: radii.card, borderWidth: sizes.hairline },
  facts: { paddingHorizontal: layout.cardPadding, paddingVertical: spacing.xs },
  fact: {
    minHeight: sizes.touch + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xxl,
    paddingVertical: spacing.m,
  },
  factValue: { textAlign: 'right', flexShrink: 1 },
  trend: { padding: layout.cardPadding, gap: spacing.l },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
