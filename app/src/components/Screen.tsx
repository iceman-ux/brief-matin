// Cadre commun des écrans : fond du skin, zones sûres, marges, défilement.
// Mise en page en flux : avec une grande taille de texte iOS, l'écran
// s'allonge et défile au lieu de faire se chevaucher les blocs.
//
// Le grain est une seule image de 256 px répétée en mosaïque par le système
// (resizeMode « repeat ») : une texture en mémoire, rien à recalculer au
// défilement, qui passe dessus. Il ne bouge pas : il reste même quand les
// animations sont coupées.
import type { ReactNode } from 'react';
import { Image, ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
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
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={GRAIN}
          resizeMode="repeat"
          accessibilityIgnoresInvertColors
          style={[styles.grain, { opacity: skin.grain }]}
        />
      </View>
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

const GRAIN = require('../../assets/grain.png');

const styles = StyleSheet.create({
  root: { flex: 1 },
  grain: { width: '100%', height: '100%' },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter },
});
