// Cadre commun des écrans : fond du skin, zones sûres, marges, défilement.
// Mise en page en flux : avec une grande taille de texte iOS, l'écran
// s'allonge et défile au lieu de faire se chevaucher les blocs.
import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSkin } from '../skins';
import { layout } from '../theme';

type Props = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Dessiné sous le contenu, sans défiler (fond de l'écran Réveil). */
  backdrop?: ReactNode;
};

export function Screen({ children, contentStyle, backdrop }: Props) {
  const skin = useSkin();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: skin.bg }]}>
      {backdrop}
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, layout.minTopInset) + layout.top,
            paddingBottom: insets.bottom + layout.bottom,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter },
});
