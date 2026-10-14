// Feuille qui monte du bas, sur un voile : fiche zone, briefs précédents.
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMotion } from '../motion';
import { useSkin } from '../skins';
import { layout, radii, sizes, spacing } from '../theme';

const RISE_MS = 350;
const RISE_FROM = 40;

type Props = { visible: boolean; onClose: () => void; closeLabel: string; children: ReactNode };

export function Sheet({ visible, onClose, closeLabel, children }: Props) {
  const skin = useSkin();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    if (!motion) {
      rise.setValue(1);
      return;
    }
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: RISE_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }).start();
  }, [visible, motion, rise]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: skin.scrim }]}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: skin.sheet,
              borderColor: skin.line,
              paddingBottom: layout.sheetBottom + insets.bottom,
              opacity: rise,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [RISE_FROM, 0] }) }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: skin.line2 }]} />
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: sizes.maxAppWidth,
    maxHeight: '88%',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: sizes.hairline,
    paddingTop: layout.sheetTop,
    paddingHorizontal: layout.gutter,
  },
  handle: {
    alignSelf: 'center',
    width: sizes.handleWidth,
    height: sizes.handleHeight,
    borderRadius: radii.handle,
    marginBottom: spacing.block,
  },
  content: { gap: spacing.block },
});
