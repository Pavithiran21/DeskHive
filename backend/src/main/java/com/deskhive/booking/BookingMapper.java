package com.deskhive.booking;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.deskhive.booking.BookingDtos.Actions;
import com.deskhive.booking.BookingDtos.BookingResponse;
import com.deskhive.booking.BookingDtos.Cancellation;
import com.deskhive.booking.BookingDtos.CheckInWindow;
import com.deskhive.booking.BookingDtos.Person;
import com.deskhive.booking.BookingDtos.SpaceInfo;
import com.deskhive.common.web.TimeText;
import com.deskhive.office.Feature;
import com.deskhive.office.Floor;
import com.deskhive.office.FloorRepository;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.Space;
import com.deskhive.office.SpaceRepository;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserStatus;

/**
 * Builds booking responses for a list at once (spaces, floors, offices and people are loaded in
 * batches, not one query per row). Live names are used while the space still exists; the booking's
 * own snapshots are used after it was deleted.
 */
@Component
public class BookingMapper {

    private final SpaceRepository spaces;
    private final FloorRepository floors;
    private final OfficeRepository offices;
    private final UserRepository users;
    private final Clock clock;

    public BookingMapper(SpaceRepository spaces, FloorRepository floors, OfficeRepository offices,
            UserRepository users, Clock clock) {
        this.spaces = spaces;
        this.floors = floors;
        this.offices = offices;
        this.users = users;
        this.clock = clock;
    }

    /**
     * @param adminView true for /api/admin/bookings: shows the person and applies the Admin cancel rule
     *                  (any active booking that has not ended). Otherwise the Employee rule applies.
     */
    public List<BookingResponse> toResponses(List<Booking> bookings, boolean adminView) {
        Lookups lookups = load(bookings);
        Instant now = clock.instant();
        return bookings.stream().map(booking -> toResponse(booking, adminView, now, lookups)).toList();
    }

    public BookingResponse toResponse(Booking booking, boolean adminView) {
        return toResponses(List.of(booking), adminView).get(0);
    }

    private BookingResponse toResponse(Booking b, boolean adminView, Instant now, Lookups lookups) {
        ZoneId zone = ZoneId.of(b.getTimeZone());
        Space space = b.getSpaceId() == null ? null : lookups.spaces.get(b.getSpaceId());
        Floor floor = space == null ? null : lookups.floors.get(space.getFloorId());
        Office office = b.getOfficeId() == null ? null : lookups.offices.get(b.getOfficeId());

        SpaceInfo spaceInfo = new SpaceInfo(
                b.getSpaceId(),
                b.getSpaceType(),
                space != null ? space.label() : b.getSpaceLabel(),
                space != null ? space.getArea() : null,
                floor != null ? floor.getId() : null,
                floor != null ? floor.getName() : b.getFloorName(),
                b.getOfficeId(),
                office != null ? office.getName() : b.getOfficeName(),
                space != null ? space.getFeatures() : Set.<Feature>of());

        CheckInWindow checkIn = new CheckInWindow(b.checkInOpensAt(), b.checkInClosesAt(),
                TimeText.clock(b.checkInOpensAt(), zone), TimeText.clock(b.checkInClosesAt(), zone));

        Cancellation cancellation = null;
        if (b.getStatus() == BookingStatus.CANCELLED) {
            User by = b.getCancelledBy() == null ? null : lookups.users.get(b.getCancelledBy());
            boolean byAdmin = b.getCancelledBy() != null && !b.getCancelledBy().equals(b.getUserId());
            cancellation = new Cancellation(by == null ? null : by.displayName(), byAdmin, b.getCancelReason());
        }

        Person person = null;
        if (adminView) {
            User owner = lookups.users.get(b.getUserId());
            person = personOf(owner);
        }

        return new BookingResponse(b.getId(), b.getStatus(), b.hasEnded(now), spaceInfo, b.getBookingDate(),
                b.getStartAt().atZone(zone).toLocalTime(), b.getEndAt().atZone(zone).toLocalTime(),
                b.getStartAt(), b.getEndAt(), b.getTimeZone(), TimeText.zoneName(zone, b.getStartAt()), checkIn,
                b.getCreatedAt(), b.getCheckedInAt(), cancellation, actionsOf(b, adminView, now), person);
    }

    /** The "Booking actions by status" table: what the viewer may do with this booking right now. */
    static Actions actionsOf(Booking b, boolean adminView, Instant now) {
        boolean confirmed = b.getStatus() == BookingStatus.CONFIRMED;
        boolean canChange = confirmed && b.getSpaceId() != null && now.isBefore(b.getStartAt());
        boolean active = BookingStatus.ACTIVE.contains(b.getStatus());
        boolean canCancel = (adminView ? active : confirmed) && now.isBefore(b.getEndAt());
        boolean canCheckIn = confirmed && !now.isBefore(b.checkInOpensAt()) && !now.isAfter(b.checkInClosesAt());
        return new Actions(canChange, canCancel, canCheckIn);
    }

    private static Person personOf(User owner) {
        if (owner == null) {
            return new Person(null, User.FORMER_EMPLOYEE, null, "FORMER_EMPLOYEE");
        }
        if (owner.getStatus() == UserStatus.DELETED) {
            return new Person(owner.getId(), User.FORMER_EMPLOYEE, null, "FORMER_EMPLOYEE");
        }
        String tag = owner.getStatus() == UserStatus.REMOVED ? "REMOVED" : null;
        return new Person(owner.getId(), owner.getName(), owner.getEmail(), tag);
    }

    private Lookups load(List<Booking> bookings) {
        Set<Long> spaceIds = new HashSet<>();
        Set<Long> officeIds = new HashSet<>();
        Set<Long> userIds = new HashSet<>();
        for (Booking b : bookings) {
            if (b.getSpaceId() != null) {
                spaceIds.add(b.getSpaceId());
            }
            if (b.getOfficeId() != null) {
                officeIds.add(b.getOfficeId());
            }
            userIds.add(b.getUserId());
            if (b.getCancelledBy() != null) {
                userIds.add(b.getCancelledBy());
            }
        }
        Lookups lookups = new Lookups();
        spaces.findByIdIn(spaceIds).forEach(space -> lookups.spaces.put(space.getId(), space));
        Set<Long> floorIds = new HashSet<>();
        lookups.spaces.values().forEach(space -> floorIds.add(space.getFloorId()));
        floors.findByIdIn(floorIds).forEach(floor -> lookups.floors.put(floor.getId(), floor));
        offices.findAllById(officeIds).forEach(office -> lookups.offices.put(office.getId(), office));
        users.findAllById(userIds).forEach(user -> lookups.users.put(user.getId(), user));
        return lookups;
    }

    private static final class Lookups {
        final Map<Long, Space> spaces = new HashMap<>();
        final Map<Long, Floor> floors = new HashMap<>();
        final Map<Long, Office> offices = new HashMap<>();
        final Map<Long, User> users = new HashMap<>();
    }
}
