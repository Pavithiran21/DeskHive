import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // 4xx answers are final (a 404 stays a 404); only a network failure or a 5xx is retried once.
      retry: (failureCount, error) => failureCount < 1 && (error?.status === 0 || error?.status >= 500),
    },
  },
});

// One place for the cache keys, so a mutation invalidates exactly what it changed.
export const keys = {
  demo: ['demo'],
  offices: ['offices'],
  availability: (params) => ['availability', params],
  seatMap: (floorId, params) => ['seat-map', String(floorId), params],
  roomDay: (roomId, date) => ['room-day', String(roomId), date],
  myBookings: (tab, page) => ['bookings', tab, page],
  booking: (id) => ['booking', String(id)],
  adminSpaces: (params) => ['admin', 'spaces', params],
  people: (params) => ['admin', 'people', params],
  allBookings: (params) => ['admin', 'bookings', params],
  occupancy: (params) => ['admin', 'occupancy', params],
};

/**
 * After a booking is made, changed, cancelled or checked in, everything that shows free seats or
 * bookings is stale: the Home counts, the seat maps, the room days and the booking lists.
 */
export function invalidateBookingViews() {
  ['availability', 'seat-map', 'room-day', 'bookings', 'booking'].forEach((root) =>
    queryClient.invalidateQueries({ queryKey: [root] }),
  );
  queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'occupancy'] });
}
