package com.deskhive.availability;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.deskhive.office.Feature;
import com.deskhive.user.UserResponse.OfficeBrief;

/** Responses of the search endpoints. Times are local to the office; the zone is named in timeZoneName. */
public final class AvailabilityDtos {

    private AvailabilityDtos() {
    }

    public record TimeRange(LocalTime from, LocalTime to) {
    }

    /** One Home card for a group of desks: "14 of 50 desks free". freeWithFeature counts only free desks. */
    public record DeskArea(Long floorId, String floor, String area, int total, int free,
            Map<Feature, Long> freeWithFeature) {
    }

    /** One Home card for a meeting room: freeForWindow for the chosen time, freeTimes for the whole day. */
    public record RoomCard(Long id, String name, Long floorId, String floor, int capacity, Set<Feature> features,
            boolean freeForWindow, List<TimeRange> freeTimes) {
    }

    public record AvailabilityResponse(OfficeBrief office, LocalDate date, LocalTime from, LocalTime to,
            String timeZoneName, List<DeskArea> deskAreas, List<RoomCard> rooms) {
    }

    /** FREE, BOOKED (by someone else, never named) or MINE (the requester's own booking for this time). */
    public enum SeatState {
        FREE, BOOKED, MINE
    }

    public record Seat(Long id, String label, String area, String row, int number, Set<Feature> features,
            SeatState state, Long myBookingId) {
    }

    public record SeatMapResponse(Long floorId, String floor, OfficeBrief office, String area, LocalDate date,
            LocalTime from, LocalTime to, String timeZoneName, List<Seat> seats) {
    }

    /** A booked block on the room's day bar. Never says who booked it; mine marks the requester's own. */
    public record Block(LocalTime from, LocalTime to, boolean mine, Long bookingId) {
    }

    public record RoomDayResponse(Long id, String name, int capacity, Set<Feature> features, Long floorId, String floor,
            OfficeBrief office, LocalDate date, LocalTime opensAt, LocalTime closesAt, int maxBookingMinutes,
            String timeZoneName, List<Block> blocks) {
    }
}
