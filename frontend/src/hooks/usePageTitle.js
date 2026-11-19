import { useEffect } from 'react';

/** "My bookings · DeskHive" in the browser tab. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · DeskHive` : 'DeskHive';
  }, [title]);
}
