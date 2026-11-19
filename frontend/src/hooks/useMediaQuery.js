import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches, for example useMediaQuery('(max-width: 859px)'). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** The phone layout (below 860 px), where the menu is a bottom sheet and the reserve button a sticky bar. */
export function useIsPhone() {
  return useMediaQuery('(max-width: 859px)');
}
