package com.deskhive.booking;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

import com.deskhive.office.Feature;
import com.deskhive.office.SpaceType;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request and response bodies of /api/bookings and /api/admin/bookings. Times are in the office's zone. */
public final class BookingDtos {

    private BookingDtos() {
    }

    public record CreateBookingRequest(
            @NotNull(message = "Pick a desk or a room.") Long spaceId,
            @NotNull(message = "Pick a date.") LocalDate date,
            @NotNull(message = "Pick a start time.") LocalTime startTime,
            @NotNull(message = "Pick an end time.") LocalTime endTime) {
    }

    /** spaceId is optional: leave it out (or send the same one) to keep the desk and change only the time. */
    public record ChangeBookingRequest(
            Long spaceId,
            @NotNull(message = "Pick a date.") LocalDate date,
            @NotNull(message = "Pick a start time.") LocalTime startTime,
            @NotNull(message = "Pick an end time.") LocalTime endTime) {
    }

    public record CancelRequest(@Size(max = 200, message = "Use at most 200 characters.") String reason) {
    }

    /** Where the booking is. id is null once the space was deleted; the labels are snapshots. */
    public record SpaceInfo(Long id, SpaceType type, String label, String area, Long floorId, String floor,
            Long officeId, String office, Set<Feature> features) {
    }

    public record CheckInWindow(Instant opensAt, Instant closesAt, String opensAtLocal, String closesAtLocal) {
    }

    public record Cancellation(String byName, boolean byAdmin, String reason) {
    }

    /** The buttons this booking allows for the viewer right now (see "Booking actions by status"). */
    public record Actions(boolean canChange, boolean canCancel, boolean canCheckIn) {
    }

    /** Only in the admin views. tag is REMOVED or FORMER_EMPLOYEE when the person is no longer active. */
    public record Person(Long id, String name, String email, String tag) {
    }

    public record BookingResponse(
            Long id,
            BookingStatus status,
            boolean ended,
            SpaceInfo space,
            LocalDate date,
            LocalTime startTime,
            LocalTime endTime,
            Instant startAt,
            Instant endAt,
            String timeZone,
            String timeZoneName,
            CheckInWindow checkIn,
            Instant bookedAt,
            Instant checkedInAt,
            Cancellation cancellation,
            Actions actions,
            Person person) {
    }
}
