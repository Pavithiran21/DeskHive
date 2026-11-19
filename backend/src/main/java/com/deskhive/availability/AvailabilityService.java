package com.deskhive.availability;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.availability.AvailabilityDtos.AvailabilityResponse;
import com.deskhive.availability.AvailabilityDtos.Block;
import com.deskhive.availability.AvailabilityDtos.DeskArea;
import com.deskhive.availability.AvailabilityDtos.RoomCard;
import com.deskhive.availability.AvailabilityDtos.RoomDayResponse;
import com.deskhive.availability.AvailabilityDtos.Seat;
import com.deskhive.availability.AvailabilityDtos.SeatMapResponse;
import com.deskhive.availability.AvailabilityDtos.SeatState;
import com.deskhive.availability.AvailabilityDtos.TimeRange;
import com.deskhive.booking.Booking;
import com.deskhive.booking.BookingRepository;
import com.deskhive.booking.BookingRules;
import com.deskhive.booking.BookingWindow;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.web.TimeText;
import com.deskhive.office.Feature;
import com.deskhive.office.Floor;
import com.deskhive.office.FloorRepository;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.Space;
import com.deskhive.office.SpaceRepository;
import com.deskhive.user.CurrentUser;
import com.deskhive.user.UserResponse.OfficeBrief;

/**
 * Read-only search for the Home cards, the seat map and the room day bar. A time is checked with the
 * same {@link BookingRules} as a booking, so the search never offers a time that a booking would refuse.
 * Nothing here says who booked a space: only "booked" or "yours".
 */
@Service
public class AvailabilityService {

    private final OfficeRepository offices;
    private final FloorRepository floors;
    private final SpaceRepository spaces;
    private final BookingRepository bookings;
    private final BookingRules rules;
    private final Clock clock;

    public AvailabilityService(OfficeRepository offices, FloorRepository floors, SpaceRepository spaces,
            BookingRepository bookings, BookingRules rules, Clock clock) {
        this.offices = offices;
        this.floors = floors;
        this.spaces = spaces;
        this.bookings = bookings;
        this.rules = rules;
        this.clock = clock;
    }

    /** Home: each desk area with "free of total" for the window, and each room with its free times that day. */
    @Transactional(readOnly = true)
    public AvailabilityResponse search(Long officeId, LocalDate date, LocalTime from, LocalTime to) {
        Office office = offices.findById(officeId).orElseThrow(() -> ApiException.notFound("Office"));
        BookingWindow window = rules.check(office, date, from, to);

        List<Space> all = spaces.findByOfficeId(officeId);
        Map<Long, Floor> floorById = floors.findByOfficeIdOrderByNameAsc(officeId).stream()
                .collect(Collectors.toMap(Floor::getId, floor -> floor));

        // One query for the desks that are taken in the window, one for the rooms' bookings that day.
        List<Space> desks = all.stream().filter(Space::isDesk).toList();
        Set<Long> takenDesks = desks.isEmpty() ? Set.of()
                : Set.copyOf(bookings.findBookedSpaceIds(desks.stream().map(Space::getId).toList(), window.start(), window.end()));

        record AreaKey(Long floorId, String area) {
        }
        Map<AreaKey, List<Space>> byArea = new LinkedHashMap<>();
        desks.stream()
                .sorted(Comparator.comparing((Space desk) -> floorById.get(desk.getFloorId()).getName()).thenComparing(Space::getArea))
                .forEach(desk -> byArea.computeIfAbsent(new AreaKey(desk.getFloorId(), desk.getArea()), key -> new ArrayList<>()).add(desk));

        List<DeskArea> deskAreas = new ArrayList<>();
        byArea.forEach((key, areaDesks) -> {
            List<Space> free = areaDesks.stream().filter(desk -> !takenDesks.contains(desk.getId())).toList();
            Map<Feature, Long> freeWithFeature = new EnumMap<>(Feature.class);
            for (Feature feature : Feature.DESK_FEATURES) {
                long count = free.stream().filter(desk -> desk.getFeatures().contains(feature)).count();
                if (count > 0) {
                    freeWithFeature.put(feature, count);
                }
            }
            deskAreas.add(new DeskArea(key.floorId(), floorById.get(key.floorId()).getName(), key.area(), areaDesks.size(),
                    free.size(), freeWithFeature));
        });

        List<Space> rooms = all.stream().filter(space -> !space.isDesk())
                .sorted(Comparator.comparing((Space room) -> floorById.get(room.getFloorId()).getName()).thenComparing(Space::getName))
                .toList();
        List<RoomCard> roomCards = roomCards(office, date, window, rooms, floorById);

        return new AvailabilityResponse(brief(office), date, from, to, TimeText.zoneName(office.zone(), window.start()),
                deskAreas, roomCards);
    }

    /** The seat map of one floor (optionally one area) for a time. The requester's own seat is marked MINE. */
    @Transactional(readOnly = true)
    public SeatMapResponse seatMap(CurrentUser actor, Long floorId, String area, LocalDate date, LocalTime from, LocalTime to) {
        Floor floor = floors.findById(floorId).orElseThrow(() -> ApiException.notFound("Floor"));
        Office office = offices.findById(floor.getOfficeId()).orElseThrow();
        BookingWindow window = rules.check(office, date, from, to);

        List<Space> desks = spaces.findByFloorId(floorId).stream()
                .filter(Space::isDesk)
                .filter(desk -> area == null || area.isBlank() || desk.getArea().equals(area))
                .sorted(Comparator.comparing(Space::getRowLabel).thenComparing(Space::getSeatNumber))
                .toList();
        Map<Long, Booking> bookedBy = new HashMap<>();
        if (!desks.isEmpty()) {
            bookings.findActiveOverlapping(desks.stream().map(Space::getId).toList(), window.start(), window.end())
                    .forEach(booking -> bookedBy.putIfAbsent(booking.getSpaceId(), booking));
        }
        List<Seat> seats = desks.stream().map(desk -> {
            Booking booking = bookedBy.get(desk.getId());
            boolean mine = booking != null && booking.getUserId().equals(actor.id());
            SeatState state = booking == null ? SeatState.FREE : mine ? SeatState.MINE : SeatState.BOOKED;
            return new Seat(desk.getId(), desk.label(), desk.getArea(), desk.getRowLabel(), desk.getSeatNumber(),
                    desk.getFeatures(), state, mine ? booking.getId() : null);
        }).toList();

        return new SeatMapResponse(floor.getId(), floor.getName(), brief(office), area, date, from, to,
                TimeText.zoneName(office.zone(), window.start()), seats);
    }

    /** The room page: its facts and the booked blocks of one day, from opening to closing time. */
    @Transactional(readOnly = true)
    public RoomDayResponse roomDay(CurrentUser actor, Long roomId, LocalDate date) {
        Space room = spaces.findById(roomId).filter(space -> !space.isDesk()).orElseThrow(() -> ApiException.notFound("Room"));
        Floor floor = floors.findById(room.getFloorId()).orElseThrow();
        Office office = offices.findById(floor.getOfficeId()).orElseThrow();
        rules.checkDay(office, date);

        ZoneId zone = office.zone();
        Instant dayStart = ZonedDateTime.of(date, office.getOpensAt(), zone).toInstant();
        Instant dayEnd = ZonedDateTime.of(date, office.getClosesAt(), zone).toInstant();
        List<Block> blocks = bookings.findActiveOverlapping(List.of(roomId), dayStart, dayEnd).stream()
                .map(booking -> new Block(booking.getStartAt().atZone(zone).toLocalTime(),
                        booking.getEndAt().atZone(zone).toLocalTime(), booking.getUserId().equals(actor.id()),
                        booking.getUserId().equals(actor.id()) ? booking.getId() : null))
                .toList();
        return new RoomDayResponse(room.getId(), room.getName(), room.getCapacity(), room.getFeatures(), floor.getId(),
                floor.getName(), brief(office), date, office.getOpensAt(), office.getClosesAt(),
                office.getMaxBookingMinutes(), TimeText.zoneName(zone, dayStart), blocks);
    }

    // ---- Helpers ----

    private List<RoomCard> roomCards(Office office, LocalDate date, BookingWindow window, List<Space> rooms,
            Map<Long, Floor> floorById) {
        if (rooms.isEmpty()) {
            return List.of();
        }
        ZoneId zone = office.zone();
        Instant dayStart = ZonedDateTime.of(date, office.getOpensAt(), zone).toInstant();
        Instant dayEnd = ZonedDateTime.of(date, office.getClosesAt(), zone).toInstant();
        List<Booking> dayBookings = bookings.findActiveOverlapping(rooms.stream().map(Space::getId).toList(), dayStart, dayEnd);

        // Today, the part of the day that has already started can't be booked any more.
        LocalTime earliest = office.getOpensAt();
        Instant now = clock.instant();
        if (now.atZone(zone).toLocalDate().equals(date)) {
            LocalTime nowLocal = now.atZone(zone).toLocalTime();
            LocalTime nextHalfHour = nowLocal.getMinute() < 30 ? nowLocal.withMinute(30).withSecond(0).withNano(0)
                    : nowLocal.plusHours(1).withMinute(0).withSecond(0).withNano(0);
            if (nextHalfHour.isAfter(earliest)) {
                earliest = nextHalfHour;
            }
        }
        final LocalTime from = earliest;

        List<RoomCard> cards = new ArrayList<>();
        for (Space room : rooms) {
            List<TimeRange> busy = dayBookings.stream()
                    .filter(booking -> room.getId().equals(booking.getSpaceId()))
                    .map(booking -> new TimeRange(booking.getStartAt().atZone(zone).toLocalTime(),
                            booking.getEndAt().atZone(zone).toLocalTime()))
                    .toList();
            boolean freeForWindow = busy.stream().noneMatch(block -> block.from().isBefore(window.endTime())
                    && block.to().isAfter(window.startTime()));
            cards.add(new RoomCard(room.getId(), room.getName(), room.getFloorId(), floorById.get(room.getFloorId()).getName(),
                    room.getCapacity(), room.getFeatures(), freeForWindow, freeRanges(from, office.getClosesAt(), busy)));
        }
        return cards;
    }

    /** The gaps between busy blocks inside [from, to], as ranges (a day with no bookings is one range). */
    static List<TimeRange> freeRanges(LocalTime from, LocalTime to, List<TimeRange> busy) {
        List<TimeRange> free = new ArrayList<>();
        LocalTime cursor = from;
        for (TimeRange block : busy.stream().sorted(Comparator.comparing(TimeRange::from)).toList()) {
            if (block.from().isAfter(cursor)) {
                free.add(new TimeRange(cursor, block.from().isBefore(to) ? block.from() : to));
            }
            if (block.to().isAfter(cursor)) {
                cursor = block.to();
            }
        }
        if (cursor.isBefore(to)) {
            free.add(new TimeRange(cursor, to));
        }
        return free.stream().filter(range -> range.to().isAfter(range.from())).toList();
    }

    private static OfficeBrief brief(Office office) {
        return new OfficeBrief(office.getId(), office.getName(), office.getTimeZone());
    }
}
