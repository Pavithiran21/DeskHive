package com.deskhive.booking;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.deskhive.common.error.ApiException;
import com.deskhive.common.web.TimeText;
import com.deskhive.office.Office;

/**
 * The per-office booking rules that depend only on the requested time: 30-minute steps, the book-ahead
 * limit, opening hours, the longest booking and "not already started". (One desk a day and overlaps
 * need the database and live in {@link BookingService}.)
 *
 * The request carries a local date and local times in the office's zone, never UTC instants: that way a
 * browser in another zone can't shift a booking, and opening hours are compared in the zone they were set in.
 * A malformed time is a 400; a time that breaks a rule is a 422 with a code the frontend can switch on.
 */
@Component
public class BookingRules {

    private final Clock clock;

    public BookingRules(Clock clock) {
        this.clock = clock;
    }

    public BookingWindow check(Office office, LocalDate date, LocalTime startTime, LocalTime endTime) {
        requireHalfHourStep("startTime", startTime);
        requireHalfHourStep("endTime", endTime);
        if (!endTime.isAfter(startTime)) {
            throw ApiException.invalidField("endTime", "The end time must be after the start time.");
        }

        ZoneId zone = office.zone();
        Instant now = clock.instant();

        checkDay(office, date);
        if (startTime.isBefore(office.getOpensAt()) || endTime.isAfter(office.getClosesAt())) {
            throw rule("OUTSIDE_OPENING_HOURS", "Pick a time inside opening hours ("
                    + TimeText.clock(office.getOpensAt()) + " – " + TimeText.clock(office.getClosesAt()) + " "
                    + TimeText.zoneName(zone, now) + "). A booking can be at most " + TimeText.length(office.maxBooking()) + ".");
        }
        if (Duration.between(startTime, endTime).compareTo(office.maxBooking()) > 0) {
            throw rule("TOO_LONG", "A booking can be at most " + TimeText.length(office.maxBooking()) + ". Pick a shorter time.");
        }

        Instant start = ZonedDateTime.of(date, startTime, zone).toInstant();
        Instant end = ZonedDateTime.of(date, endTime, zone).toInstant();
        if (!start.isAfter(now)) {
            throw rule("ALREADY_STARTED", "That time has already started. It's " + TimeText.clock(now, zone) + " "
                    + TimeText.zoneName(zone, now) + ". Pick a later time.");
        }
        return new BookingWindow(date, startTime, endTime, start, end);
    }

    /** Only the day: not in the past and not beyond the book-ahead limit (the room page and the date picker). */
    public void checkDay(Office office, LocalDate date) {
        LocalDate today = clock.instant().atZone(office.zone()).toLocalDate();
        LocalDate lastDay = today.plusDays(office.getBookAheadDays());
        if (date.isBefore(today)) {
            throw rule("ALREADY_STARTED", "That day has already passed. Pick today or a later day.");
        }
        if (date.isAfter(lastDay)) {
            throw rule("TOO_FAR_AHEAD", "That's outside the booking rules. You can book up to "
                    + office.getBookAheadDays() + " days ahead. Pick a date on or before " + TimeText.shortDate(lastDay) + ".");
        }
    }

    private static void requireHalfHourStep(String field, LocalTime time) {
        if (time.getSecond() != 0 || time.getNano() != 0 || time.getMinute() % 30 != 0) {
            throw ApiException.invalidField(field, "Use 30-minute steps, like 9:00 or 9:30.");
        }
    }

    static ApiException rule(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, code, message);
    }
}
