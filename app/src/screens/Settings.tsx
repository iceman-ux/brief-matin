// Réglages : réveil, lecture, affichage, à propos. Un appui long sur le logo
// ouvre l'accès caché : alarme de test dans une minute, et les skins pas
// encore proposés.
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AI_NOTICE, CONTACT_EMAIL } from '../../constants';
import { Device } from '../components/Device';
import { Screen } from '../components/Screen';
import { Switch } from '../components/Switch';
import type { Episode } from '../episodes';
import { ChevronLeftIcon } from '../icons';
import { useReducedMotion } from '../motion';
import { formatStamp, shiftTime, toggleDay } from '../schedule';
import type { Settings as SettingsData } from '../settings';
import { PUBLIC_SKINS, SKINS, type SkinName, useSkin } from '../skins';
import { layout, radii, sizes, spacing, type } from '../theme';
import { Brand, DayPicker, GhostButton, Label, TimeSetter, WebNotice } from '../ui';

type Toggle = { key: 'autoplayAfterAlarm' | 'downloadOnCellular' | 'animations'; label: string; hint: string };

const GROUPS: { name: string; items: Toggle[] }[] = [
  {
    name: 'Lecture',
    items: [
      { key: 'autoplayAfterAlarm', label: 'Lecture auto au réveil', hint: 'Le brief démarre avec l’alarme' },
      { key: 'downloadOnCellular', label: 'Télécharger en 4G / 5G', hint: 'Sinon, uniquement en Wi-Fi' },
    ],
  },
  {
    name: 'Affichage',
    items: [{ key: 'animations', label: 'Animations', hint: 'Carte, spectre et globe en mouvement' }],
  },
];

const REDUCED_HINT = 'Coupées : « Réduire les animations » est activé sur l’iPhone';

type Props = {
  settings: SettingsData;
  onChange: (settings: SettingsData) => void;
  onBack: () => void;
  /** Rend le message à afficher sous le logo. */
  onTestAlarm: () => Promise<string>;
  lastEpisode: Episode | null;
};

export function Settings({ settings, onChange, onBack, onTestAlarm, lastEpisode }: Props) {
  const skin = useSkin();
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const alarm = settings.alarm;
  const skins = (hidden ? Object.keys(SKINS) : PUBLIC_SKINS) as SkinName[];

  return (
    <Screen>
      <GhostButton label="Retour à l'accueil" round={sizes.touch} onPress={onBack}>
        <ChevronLeftIcon size={sizes.icon} color={skin.text} />
      </GhostButton>
      <Text style={[type.screenTitle, styles.title, { color: skin.text }]} accessibilityRole="header">
        Réglages
      </Text>

      <Section title="Réveil" first>
        <Device contentStyle={styles.alarm}>
          <TimeSetter framed={false} schedule={alarm} onShift={(m) => onChange({ ...settings, alarm: shiftTime(alarm, m) })} />
          <DayPicker weekdays={alarm.weekdays} onToggle={(d) => onChange({ ...settings, alarm: toggleDay(alarm, d) })} />
          <View style={[styles.hair, { backgroundColor: skin.line }]} />
          {/* Un seul son pour l'instant : la ligne n'ouvre rien. */}
          <View style={styles.sound} accessible>
            <Text style={[type.body, { color: skin.text }]}>Son du réveil</Text>
            <Text style={[type.value, { color: skin.text2 }]}>Sonal Lora</Text>
          </View>
        </Device>
        <WebNotice />
      </Section>

      {GROUPS.map((group) => (
        <Section key={group.name} title={group.name}>
          <Card>
            {group.items.map((item, i) => {
              const on = settings[item.key];
              const hint = item.key === 'animations' && reduced ? REDUCED_HINT : item.hint;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="switch"
                  accessibilityLabel={item.label}
                  accessibilityHint={hint}
                  accessibilityState={{ checked: on }}
                  onPress={() => onChange({ ...settings, [item.key]: !on })}
                  style={[styles.toggle, i > 0 && { borderTopWidth: sizes.hairline, borderTopColor: skin.line }]}
                >
                  <View style={styles.toggleText}>
                    <Text style={[type.body, { color: skin.text }]}>{item.label}</Text>
                    <Text style={[type.hint, { color: skin.text3 }]}>{hint}</Text>
                  </View>
                  <Switch on={on} />
                </Pressable>
              );
            })}
          </Card>
        </Section>
      ))}

      {skins.length > 1 && (
        <Section title="Skin">
          <View style={styles.skins}>
            {skins.map((name) => (
              <GhostButton
                key={name}
                label={`Skin ${name}`}
                selected={settings.skin === name}
                onPress={() => onChange({ ...settings, skin: name })}
                style={[styles.skin, settings.skin === name && { backgroundColor: skin.surface2 }]}
              >
                <Text style={[type.button, { color: settings.skin === name ? skin.text : skin.text3 }]}>{name}</Text>
              </GhostButton>
            ))}
          </View>
        </Section>
      )}

      <Section title="À propos">
        <Card padded>
          <Text style={[type.about, { color: skin.text2 }]}>{AI_NOTICE}</Text>
          <View style={[styles.hair, { backgroundColor: skin.line }]} />
          {lastEpisode && (
            <View style={styles.about} accessible>
              <Label>Dernier brief</Label>
              <Text style={[type.dataMedium, { color: skin.text }]}>{formatStamp(lastEpisode.pubDate)}</Text>
            </View>
          )}
          <View style={styles.about} accessible>
            <Label>Contact</Label>
            <Text style={[type.dataMedium, styles.email, { color: skin.text }]}>{CONTACT_EMAIL}</Text>
          </View>
        </Card>
      </Section>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="Lora"
          accessibilityHint="Appui long : accès caché"
          onLongPress={() => setHidden(true)}
          style={styles.footerLogo}
        >
          <Brand small />
        </Pressable>
        {hidden && (
          <GhostButton label="Alarme de test dans 1 min" onPress={async () => setTestMessage(await onTestAlarm())}>
            <Text style={[type.button, { color: skin.text2 }]}>Alarme de test dans 1 min</Text>
          </GhostButton>
        )}
        {testMessage && <Label style={styles.centered}>{testMessage}</Label>}
      </View>
    </Screen>
  );
}

function Section({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.section, !first && styles.sectionGap]}>
      <Label style={styles.sectionTitle}>{title}</Label>
      {children}
    </View>
  );
}

function Card({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  const skin = useSkin();
  return (
    <View style={[styles.card, padded && styles.cardPadded, { backgroundColor: skin.surface, borderColor: skin.line }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.block, marginBottom: spacing.sectionLoose },
  section: { gap: spacing.l },
  sectionGap: { marginTop: spacing.group },
  sectionTitle: { marginLeft: spacing.xs },
  alarm: { padding: layout.cardPadding, gap: spacing.xxl },
  hair: { height: sizes.hairline },
  sound: { minHeight: sizes.mark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { borderRadius: radii.card, borderWidth: sizes.hairline, paddingHorizontal: layout.cardPadding },
  cardPadded: { paddingVertical: layout.cardPadding, gap: spacing.xl },
  toggle: {
    minHeight: sizes.touch + spacing.sectionLoose - spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xxl,
    paddingVertical: spacing.l,
  },
  toggleText: { flexShrink: 1, gap: spacing.xs },
  skins: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  skin: { flexGrow: 1 },
  about: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l, flexWrap: 'wrap' },
  email: { flexShrink: 1 },
  footer: { marginTop: spacing.group, alignItems: 'center', gap: spacing.l },
  footerLogo: { minHeight: sizes.touch, minWidth: sizes.touch * 2, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
});
