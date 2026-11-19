import { useQuery } from '@tanstack/react-query';
import { keys } from '../api/queryClient';
import { getOffices } from '../api/spaces';

/** Every office with its rules and floors, cached (Home, the desk and room pages, admin filters). */
export function useOffices() {
  return useQuery({ queryKey: keys.offices, queryFn: getOffices, staleTime: 60_000 });
}

/** One office from the cached list, by id. */
export function useOffice(officeId) {
  const query = useOffices();
  const office = query.data?.find((entry) => String(entry.id) === String(officeId)) ?? null;
  return { ...query, office };
}
