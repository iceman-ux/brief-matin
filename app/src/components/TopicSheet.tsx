// Fiche zone : le lieu du sujet, ses sources et sa présence dans nos sources.
// Chaque ligne n'apparaît que si sa donnée existe.
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Polyline, Stop } from 'react-native-svg';

import { tintOf, useSkin } from '../skins';
import { type Topic, formatCoordinates, localTime, topicNumber, trendDirection, trendRuns } from '../topics';
import { layout, radii, sizes, spacing, type } from '../theme';
import { GhostButton, Label } from '../ui';
import { Sheet } from './Sheet';

// Repère de la courbe, étiré à la largeur de la carte.
const CHART_W = 175;
const CHART_H = 44;
const CHART_PAD = 4;
const AREA_OPACITY = 0.3;
const LINE_WIDTH = 2;

type ChartPoint = { x: number; y: number };

/** Points de chaque tronçon connu ; l'échelle vaut pour toute la courbe. */
function trendShapes(trend: (number | null)[]): ChartPoint[][] {
  const known = trend.filter((v): v is number => v !== null);
  const min = Math.min(...known);
  const span = Math.max(...known) - min || 1;
  return trendRuns(trend).map((run) =>
    run.map(({ index, value }) => ({
      x: (index * CHART_W) / (trend.length - 1),
      y: CHART_H - CHART_PAD - ((value - min) / span) * (CHART_H - 2 * CHART_PAD),
    })),
  );
}

const pointsOf = (run: ChartPoint[]) => run.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

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
              accessibilityLabel={`Présence dans nos sources sur 7 jours : ${
                trendDirection(topic.trend7d) === '▲' ? 'en hausse' : trendDirection(topic.trend7d) === '▼' ? 'en baisse' : 'stable'
              }`}
              style={[styles.card, styles.trend, { backgroundColor: skin.surface, borderColor: skin.line }]}
            >
              <View style={styles.trendHead}>
                <Label>Présence dans nos sources · 7 j</Label>
                <Label color={tint}>{trendDirection(topic.trend7d)}</Label>
              </View>
              <Svg width="100%" height={sizes.trendHeight} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`trendArea${index}`} x1={0} y1={0} x2={0} y2={1}>
                    <Stop offset={0} stopColor={tint} stopOpacity={AREA_OPACITY} />
                    <Stop offset={1} stopColor={tint} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {trendShapes(topic.trend7d).map((run) =>
                  run.length === 1 ? (
                    // Un jour connu entre deux trous : un point. Un trait de
                    // longueur nulle à bout rond reste rond, là où un cercle
                    // serait étiré avec le repère.
                    <Polyline
                      key={run[0].x}
                      points={`${pointsOf(run)} ${pointsOf(run)}`}
                      stroke={tint}
                      strokeWidth={LINE_WIDTH * 2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <Fragment key={run[0].x}>
                      <Polygon
                        points={`${pointsOf(run)} ${run[run.length - 1].x.toFixed(1)},${CHART_H} ${run[0].x.toFixed(1)},${CHART_H}`}
                        fill={`url(#trendArea${index})`}
                      />
                      <Polyline
                        points={pointsOf(run)}
                        fill="none"
                        stroke={tint}
                        strokeWidth={LINE_WIDTH}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </Fragment>
                  ),
                )}
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
