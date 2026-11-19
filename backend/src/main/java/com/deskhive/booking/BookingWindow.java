package com.deskhive.booking;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/** A checked booking time: the office-local day and times, and the same moments as UTC instants. */
public record BookingWindow(LocalDate date, LocalTime startTime, LocalTime endTime, Instant start, Instant end) {
}
