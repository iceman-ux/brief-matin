// Skin actif, fourni à tous les composants. Changer de skin change les
// couleurs et les matières, jamais la mise en page.
import { type ReactNode, createContext, useContext } from 'react';

import { ambre } from './ambre';
import { casio } from './casio';
import { chrome } from './chrome';
import { papier } from './papier';
import type { Skin, SkinName } from './types';

export type { Skin, SkinName };

export const SKINS: Record<SkinName, Skin> = { chrome, casio, ambre, papier };

export const DEFAULT_SKIN: SkinName = 'chrome';

/** Skins offerts dans les Réglages ; les autres restent derrière l'accès caché. */
export const PUBLIC_SKINS: SkinName[] = ['chrome'];

export const isSkinName = (name: unknown): name is SkinName => typeof name === 'string' && name in SKINS;

const SkinContext = createContext<Skin>(SKINS[DEFAULT_SKIN]);

export function SkinProvider({ name, children }: { name: SkinName; children: ReactNode }) {
  return <SkinContext.Provider value={SKINS[name] ?? SKINS[DEFAULT_SKIN]}>{children}</SkinContext.Provider>;
}

export const useSkin = () => useContext(SkinContext);

/** Couleur du sujet n (0, 1, 2…) : au-delà de six sujets, les teintes reviennent. */
export const tintOf = (skin: Skin, index: number) => skin.tints[index % skin.tints.length];
