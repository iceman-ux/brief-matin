// Boutons de sujet, en bas de l'Accueil : numéro et ville. Le sujet actif a
// un fond plus clair et un trait de sa couleur en haut. Au-delà de quatre
// sujets, la rangée défile.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tintOf, useSkin } from '../skins';
import { type Topic, topicNumber, topicShortName } from '../topics';
import { radii, sizes, spacing, type } from '../theme';

const ROW_MAX = 4;
// Assez étroit pour que le cinquième bouton dépasse : on voit que la rangée défile.
const SCROLL_CHIP_WIDTH = 72;
const BAR_INSET = 16;

type Props = { topics: Topic[]; active: number; onPick: (index: number) => void };

export function TopicChips({ topics, active, onPick }: Props) {
  const skin = useSkin();
  const scrolls = topics.length > ROW_MAX;
  const chips = topics.map((topic, i) => {
    const on = i === active;
    const tint = tintOf(skin, i);
    return (
      <Pressable
        key={i}
        accessibilityRole="button"
        accessibilityLabel={`Sujet ${i + 1} : ${topic.place?.country ?? topic.title}`}
        accessibilityState={{ selected: on }}
        onPress={() => onPick(i)}
        style={({ pressed }) => [
          styles.chip,
          scrolls ? styles.fixed : styles.flex,
          { borderColor: on ? skin.line2 : skin.line, backgroundColor: on ? skin.surface2 : 'transparent' },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.bar, { backgroundColor: on ? tint : 'transparent' }]} />
        <Text style={[type.data, { color: on ? tint : skin.text4 }]}>{topicNumber(i)}</Text>
        <Text numberOfLines={1} style={[type.chipCity, { color: on ? skin.text : skin.text3 }]}>
          {topicShortName(topic, i)}
        </Text>
      </Pressable>
    );
  });
  if (!scrolls) return <View style={styles.row}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.m },
  chip: {
    minHeight: sizes.chip,
    borderRadius: radii.chip,
    borderWidth: sizes.hairline,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.m,
  },
  flex: { flex: 1, flexBasis: 0 },
  fixed: { width: SCROLL_CHIP_WIDTH },
  bar: {
    position: 'absolute',
    left: BAR_INSET,
    right: BAR_INSET,
    top: 0,
    height: sizes.chipBar,
    borderBottomLeftRadius: sizes.chipBar,
    borderBottomRightRadius: sizes.chipBar,
  },
  pressed: { transform: [{ scale: 0.97 }] },
});
