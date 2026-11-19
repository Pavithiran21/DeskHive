import { IconCalendarX, IconMapPinCheck } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { cancelBooking, checkIn } from '../../api/bookings';
import { invalidateBookingViews } from '../../api/queryClient';
import { useToast } from '../../toast/ToastContext';

/**
 * Check in and Cancel for one of my bookings. Which buttons show is decided by booking.actions from
 * the API; a refusal (422 CHECK_IN_NOT_OPEN, CHECK_IN_CLOSED, INVALID_STATUS) reloads the booking
 * and the lists so the buttons match its real status again.
 */
export function useBookingActions({ onCheckInError, onCancelled, onCancelError } = {}) {
  const { showToast } = useToast();

  const checkInMutation = useMutation({
    mutationFn: (booking) => checkIn(booking.id),
    onSuccess: () => {
      invalidateBookingViews();
      showToast({ message: 'Checked in. Have a good day.', Icon: IconMapPinCheck });
    },
    onError: (error) => {
      invalidateBookingViews();
      if (onCheckInError) {
        onCheckInError(error);
      } else {
        showToast({ message: error.status >= 500 || error.status === 0 ? "Couldn't check in. Try again." : error.message, error: true });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (booking) => cancelBooking(booking.id),
    onSuccess: (booking) => {
      invalidateBookingViews();
      showToast({ message: 'Booking cancelled', Icon: IconCalendarX });
      onCancelled?.(booking);
    },
    onError: (error) => {
      invalidateBookingViews();
      onCancelError?.(error);
    },
  });

  return { checkInMutation, cancelMutation };
}
