package com.deskhive.booking;

import java.util.EnumSet;
import java.util.Set;

/**
 * "Ended" is not a status: a booking has ended when its end time has passed. CONFIRMED and CHECKED_IN
 * are the active ones: they hold the space and count in the reports.
 */
public enum BookingStatus {
    CONFIRMED,
    CHECKED_IN,
    AUTO_RELEASED,
    CANCELLED;

    public static final Set<BookingStatus> ACTIVE = EnumSet.of(CONFIRMED, CHECKED_IN);
}
