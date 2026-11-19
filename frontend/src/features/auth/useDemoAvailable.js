import { useQuery } from '@tanstack/react-query';
import { getDemo } from '../../api/demo';
import { keys } from '../../api/queryClient';

/**
 * Whether the backend runs in demo mode: GET /api/demo answers only when DEMO_MODE=true (404 otherwise).
 * Log in shows "Try the demo" only then.
 */
export function useDemoAvailable() {
  const query = useQuery({ queryKey: keys.demo, queryFn: getDemo, retry: false, staleTime: Infinity });
  return query.isSuccess;
}

export function useDemoInfo() {
  return useQuery({ queryKey: keys.demo, queryFn: getDemo, retry: false, staleTime: Infinity });
}
