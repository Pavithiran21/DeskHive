import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { useOffices } from '../../hooks/useOffices';
import { DEFAULT_SLOT, slotTimes, timeProblem } from '../../lib/slots';
import { addDays, todayIn } from '../../lib/time';

/**
 * The search (office, floor, date, time, category) lives in the URL query string, so Back, a reload
 * and a shared link all keep it: /home?office=52&date=2026-11-13&slot=morning&cat=WINDOW.
 * Missing values get defaults: the person's own office, today (or tomorrow once today's full day has
 * started) and Full day.
 */
export function useSearchState() {
  const { user } = useAuth();
  const offices = useOffices();
  const [params, setParams] = useSearchParams();

  const list = offices.data ?? [];
  const office =
    list.find((entry) => String(entry.id) === params.get('office')) ??
    list.find((entry) => entry.id === user.office?.id) ??
    list[0] ??
    null;

  const state = useMemo(() => {
    if (!office) {
      return null;
    }
    const slot = params.get('slot') ?? DEFAULT_SLOT;
    const { from, to } = slotTimes(slot, params.get('from'), params.get('to'));
    let date = params.get('date');
    if (!date) {
      const today = todayIn(office.timeZone);
      date = timeProblem({ date: today, from, to, office }) === 'started' ? addDays(today, 1) : today;
    }
    return {
      office,
      officeId: office.id,
      floorId: params.get('floor') ?? 'all',
      date,
      slot,
      from,
      to,
      category: params.get('cat') ?? 'ALL',
    };
  }, [office, params]);

  /** Changes some of the values, keeping the rest. A custom time also writes from and to. */
  const update = useCallback(
    (changes) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => {
            const name = { officeId: 'office', floorId: 'floor', category: 'cat' }[key] ?? key;
            if (value === null || value === undefined || value === '') {
              next.delete(name);
            } else {
              next.set(name, String(value));
            }
          });
          if (changes.slot && changes.slot !== 'custom') {
            next.delete('from');
            next.delete('to');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { offices, state, update };
}

/** The query string the desk and room pages are opened with, so they keep the chosen day and time. */
export function searchQuery({ officeId, date, slot, from, to }) {
  const query = new URLSearchParams({ office: String(officeId), date, slot });
  if (slot === 'custom') {
    query.set('from', from);
    query.set('to', to);
  }
  return query.toString();
}
