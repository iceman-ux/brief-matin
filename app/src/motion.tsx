// Animations : coupées si le réglage « Animations » est désactivé, ou si iOS
// a « Réduire les animations ». Les composants animés lisent useMotion().
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

const MotionContext = createContext({ enabled: true, reduced: false });

export function MotionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => alive && setReduced(value));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return <MotionContext.Provider value={{ enabled: enabled && !reduced, reduced }}>{children}</MotionContext.Provider>;
}

/** Vrai si les composants peuvent s'animer. */
export const useMotion = () => useContext(MotionContext).enabled;

/** Vrai si iOS a « Réduire les animations » : les Réglages le disent. */
export const useReducedMotion = () => useContext(MotionContext).reduced;
