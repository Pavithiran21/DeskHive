package com.deskhive.booking;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.booking.BookingDtos.BookingResponse;
import com.deskhive.booking.BookingDtos.ChangeBookingRequest;
import com.deskhive.booking.BookingDtos.CreateBookingRequest;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.error.ErrorDetail;
import com.deskhive.common.web.PageResponse;
import com.deskhive.common.web.TimeText;
import com.deskhive.mail.MailEvents.BookingCancelledByAdmin;
import com.deskhive.mail.MailEvents.BookingConfirmed;
import com.deskhive.office.Floor;
import com.deskhive.office.FloorRepository;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.Space;
import com.deskhive.office.SpaceRepository;
import com.deskhive.office.SpaceType;
import com.deskhive.user.CurrentUser;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;

/**
 * Book, change, cancel and check in: the signature feature of DeskHive.
 *
 * <h3>How double-booking is prevented</h3>
 * MySQL has no "exclusion constraint" for overlapping time ranges, so the service takes locks:
 * <ol>
 *   <li>{@code SELECT ... FOR UPDATE} on the <b>user</b> row (so one person's two parallel requests run
 *       one after the other: the "one desk a day" rule can't be passed twice at the same moment);</li>
 *   <li>{@code SELECT ... FOR UPDATE} on the <b>space</b> row (every request for this desk or room queues here);</li>
 *   <li>only then the overlap check and the INSERT, in the same transaction.</li>
 * </ol>
 * A request that waits on the space lock continues after the winner has committed, then runs its
 * overlap check and sees the winner's booking. Other spaces are not locked, so they don't wait.
 * The lock order is always user, then spaces by ascending id, then the booking row, so two requests can
 * never wait for each other (no deadlock).
 *
 * <h3>Why READ_COMMITTED</h3>
 * MySQL's default level (REPEATABLE READ) gives a transaction a snapshot at its first plain read, so a
 * later plain SELECT (the overlap check) could miss a booking that was committed after that snapshot.
 * READ_COMMITTED makes every statement see the latest committed rows. The locking reads come first anyway.
 *
 * Every other write here (change, cancel, check-in) locks the booking row before it looks at its status,
 * so it can't race with the release job or with another tab.
 */
@Service
public class BookingService {

    /** Passed as "excludeId" when no booking is being ignored (ids start at 1). */
    private static final long NO_BOOKING = -1L;

    private final BookingRepository bookings;
    private final SpaceRepository spaces;
    private final FloorRepository floors;
    private final OfficeRepository offices;
    private final UserRepository users;
    private final BookingRules rules;
    private final BookingMapper mapper;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public BookingService(BookingRepository bookings, SpaceRepository spaces, FloorRepository floors,
            OfficeRepository offices, UserRepository users, BookingRules rules, BookingMapper mapper,
            ApplicationEventPublisher events, Clock clock) {
        this.bookings = bookings;
        this.spaces = spaces;
        this.floors = floors;
        this.offices = offices;
        this.users = users;
        this.rules = rules;
        this.mapper = mapper;
        this.events = events;
        this.clock = clock;
    }

    // ---- Create ----

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BookingResponse create(CurrentUser actor, CreateBookingRequest request) {
        users.lockById(actor.id()).orElseThrow(ApiException::unauthenticated);
        Space space = spaces.lockById(request.spaceId()).orElseThrow(() -> ApiException.notFound("Space"));
        Floor floor = floors.findById(space.getFloorId()).orElseThrow();
        Office office = offices.findById(floor.getOfficeId()).orElseThrow();

        BookingWindow window = rules.check(office, request.date(), request.startTime(), request.endTime());
        ensureOneDeskADay(space, actor.id(), window, NO_BOOKING, false);
        ensureFree(space, floor, office, window, NO_BOOKING, null);

        Booking booking = bookings.save(new Booking(actor.id(), space.getId(), space.getType(), space.label(),
                floor.getName(), office.getId(), office.getName(), office.getTimeZone(),
                window.start(), window.end(), window.date()));
        events.publishEvent(new BookingConfirmed(booking.getId(), false));
        return mapper.toResponse(booking, false);
    }

    // ---- Change ----

    /**
     * Moves a booking to another date, time or desk. It is checked exactly like a new booking, except
     * that the booking being changed doesn't count against itself (one desk a day, overlaps). It all
     * happens in one transaction: if the new seat or time is taken first, the exception rolls back and
     * the old booking is untouched.
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BookingResponse change(CurrentUser actor, Long bookingId, ChangeBookingRequest request) {
        // A scalar query: it must not load the Booking into the session, or the locked re-read below
        // would return this possibly stale copy instead of the current row.
        long oldSpaceId = bookings.findOwnedSpaceId(bookingId, actor.id()).orElseThrow(() -> ApiException.notFound("Booking"));
        long newSpaceId = request.spaceId() == null || oldSpaceId == 0 ? oldSpaceId : request.spaceId();

        users.lockById(actor.id()).orElseThrow(ApiException::unauthenticated);
        Map<Long, Space> locked = lockSpacesInOrder(oldSpaceId, newSpaceId);
        Booking booking = lockOwnBooking(bookingId, actor.id());

        Instant now = clock.instant();
        if (booking.getStatus() != BookingStatus.CONFIRMED || !now.isBefore(booking.getStartAt()) || oldSpaceId == 0) {
            throw invalidStatus("This booking can't be changed any more.");
        }
        Space oldSpace = locked.get(oldSpaceId);
        Space newSpace = locked.get(newSpaceId);
        if (newSpace == null) {
            throw ApiException.invalidField("spaceId", "That space doesn't exist.");
        }
        Floor newFloor = floors.findById(newSpace.getFloorId()).orElseThrow();
        Office office = offices.findById(newFloor.getOfficeId()).orElseThrow();
        if (newSpace.getType() != oldSpace.getType() || !office.getId().equals(booking.getOfficeId())) {
            throw ApiException.invalidField("spaceId", "Pick another "
                    + (oldSpace.isDesk() ? "desk" : "time") + " at the same office.");
        }

        BookingWindow window = rules.check(office, request.date(), request.startTime(), request.endTime());
        ensureOneDeskADay(newSpace, actor.id(), window, booking.getId(), true);
        ensureFree(newSpace, newFloor, office, window, booking.getId(), oldSpace);

        booking.reschedule(newSpace.getId(), newSpace.label(), newFloor.getName(), window.start(), window.end(), window.date());
        events.publishEvent(new BookingConfirmed(booking.getId(), true));
        return mapper.toResponse(booking, false);
    }

    // ---- Cancel, check in ----

    /** An Employee cancels their own booking: allowed while it is confirmed and has not ended. */
    @Transactional
    public BookingResponse cancel(CurrentUser actor, Long bookingId) {
        Booking booking = lockOwnBooking(bookingId, actor.id());
        Instant now = clock.instant();
        if (booking.getStatus() != BookingStatus.CONFIRMED || !now.isBefore(booking.getEndAt())) {
            throw invalidStatus(switch (booking.getStatus()) {
                case CHECKED_IN -> "You've already checked in, so this booking can't be cancelled.";
                case CANCELLED -> "This booking was already cancelled.";
                case AUTO_RELEASED -> "This booking was released because it wasn't checked in.";
                default -> "This booking has ended.";
            });
        }
        booking.cancel(actor.id(), null);
        return mapper.toResponse(booking, false);
    }

    /** An Admin cancels any booking that hasn't ended, with a reason; the employee is emailed. */
    @Transactional
    public BookingResponse cancelAsAdmin(CurrentUser actor, Long bookingId, String reason) {
        actor.requireAdmin();
        Booking booking = bookings.lockById(bookingId).orElseThrow(() -> ApiException.notFound("Booking"));
        User owner = users.findById(booking.getUserId()).orElseThrow();
        if (reason == null || reason.isBlank()) {
            throw ApiException.invalidField("reason", "Add a short reason; " + firstName(owner) + " will see it.");
        }
        if (!BookingStatus.ACTIVE.contains(booking.getStatus()) || !clock.instant().isBefore(booking.getEndAt())) {
            throw invalidStatus("This booking can't be cancelled: it has ended, or it was already cancelled or released.");
        }
        booking.cancel(actor.id(), reason.trim());
        events.publishEvent(new BookingCancelledByAdmin(booking.getId()));
        return mapper.toResponse(booking, true);
    }

    /** Check-in opens 15 minutes before the start and closes 15 minutes after it. */
    @Transactional
    public BookingResponse checkIn(CurrentUser actor, Long bookingId) {
        Booking booking = lockOwnBooking(bookingId, actor.id());
        Instant now = clock.instant();
        ZoneId zone = ZoneId.of(booking.getTimeZone());
        String what = booking.getSpaceType() == SpaceType.DESK ? "seat" : "room";

        switch (booking.getStatus()) {
            case AUTO_RELEASED -> throw tooLateToCheckIn(booking, zone, what);
            case CHECKED_IN -> throw invalidStatus("You've already checked in.");
            case CANCELLED -> throw invalidStatus("This booking was cancelled, so it can't be checked in.");
            default -> { }
        }
        if (now.isBefore(booking.checkInOpensAt())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "CHECK_IN_NOT_OPEN",
                    "Check-in isn't open yet. You can check in from " + TimeText.clock(booking.checkInOpensAt(), zone)
                            + ", 15 minutes before your booking starts.");
        }
        if (now.isAfter(booking.checkInClosesAt())) {
            throw tooLateToCheckIn(booking, zone, what);
        }
        booking.checkIn(now);
        return mapper.toResponse(booking, false);
    }

    // ---- Reads ----

    @Transactional(readOnly = true)
    public BookingResponse get(CurrentUser actor, Long bookingId) {
        Booking booking = bookings.findByIdAndUserId(bookingId, actor.id()).orElseThrow(() -> ApiException.notFound("Booking"));
        return mapper.toResponse(booking, false);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> listMine(CurrentUser actor, boolean upcoming, Pageable pageable) {
        Instant now = clock.instant();
        Page<Booking> page = upcoming
                ? bookings.findUpcoming(actor.id(), now, pageable)
                : bookings.findPast(actor.id(), now, pageable);
        List<BookingResponse> items = mapper.toResponses(page.getContent(), false);
        return new PageResponse<>(items, page.getNumber() + 1, page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    @Transactional(readOnly = true)
    public BookingResponse getAsAdmin(CurrentUser actor, Long bookingId) {
        actor.requireAdmin();
        Booking booking = bookings.findById(bookingId).orElseThrow(() -> ApiException.notFound("Booking"));
        return mapper.toResponse(booking, true);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> searchAsAdmin(CurrentUser actor, Long officeId, LocalDate from, LocalDate to,
            BookingStatus status, String q, Pageable pageable) {
        actor.requireAdmin();
        if (from != null && to != null && to.isBefore(from)) {
            throw ApiException.invalidField("to", "The end date must be on or after the start date.");
        }
        String pattern = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase() + "%";
        Page<Booking> page = bookings.search(officeId, from, to, status, pattern, pageable);
        List<BookingResponse> items = mapper.toResponses(page.getContent(), true);
        return new PageResponse<>(items, page.getNumber() + 1, page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    // ---- Checks that need the database (called with the locks already held) ----

    /** One desk booking per person per day (rooms don't count). */
    private void ensureOneDeskADay(Space space, Long userId, BookingWindow window, long excludeId, boolean changing) {
        if (!space.isDesk()) {
            return;
        }
        List<Booking> existing = bookings.findDeskBookingsOnDate(userId, window.date(), excludeId, Limit.of(1));
        if (existing.isEmpty()) {
            return;
        }
        Booking other = existing.get(0);
        String when = TimeText.shortDate(other.getBookingDate());
        String message = changing
                ? "You already have a desk that day (" + other.getSpaceLabel() + ", " + when + "). Pick another day, or change that booking."
                : "You already have a desk that day. Change your " + other.getSpaceLabel() + " booking on " + when + " instead.";
        throw BookingRules.rule("ONE_DESK_PER_DAY", message);
    }

    /** 409 if the space already has an active booking that overlaps the window. */
    private void ensureFree(Space space, Floor floor, Office office, BookingWindow window, long excludeId, Space keptSpace) {
        if (bookings.countOverlapping(space.getId(), window.start(), window.end(), excludeId) == 0) {
            return;
        }
        boolean changing = excludeId != NO_BOOKING;
        if (space.isDesk()) {
            String message = space.label() + " was just booked by someone else."
                    + (changing ? " Nothing changed: " + keptSpace.label() + " is still yours. Pick another seat." : "");
            throw new ApiException(HttpStatus.CONFLICT, "SPACE_TAKEN", message, suggestionFor(space, window));
        }
        ZoneId zone = office.zone();
        String clash = bookings.findActiveOverlapping(List.of(space.getId()), window.start(), window.end()).stream()
                .filter(other -> !other.getId().equals(excludeId))
                .findFirst()
                .map(other -> " (" + TimeText.clock(other.getStartAt(), zone) + " – " + TimeText.clock(other.getEndAt(), zone) + ")")
                .orElse("");
        throw new ApiException(HttpStatus.CONFLICT, "ROOM_OVERLAP", "That time overlaps a booking" + clash + "."
                + (changing ? " Nothing changed: your booking is as it was." : " Pick a time that's free."));
    }

    /**
     * The nearest free desk in the same area for the same time, by row distance and then seat number
     * distance, so the frontend can pick it for the person. Empty when the area is full.
     */
    private List<ErrorDetail> suggestionFor(Space lost, BookingWindow window) {
        List<Space> sameArea = spaces.findByFloorIdAndType(lost.getFloorId(), SpaceType.DESK).stream()
                .filter(desk -> desk.getArea().equals(lost.getArea()) && !desk.getId().equals(lost.getId()))
                .toList();
        if (sameArea.isEmpty()) {
            return List.of();
        }
        Set<Long> booked = Set.copyOf(bookings.findBookedSpaceIds(sameArea.stream().map(Space::getId).toList(),
                window.start(), window.end()));
        return sameArea.stream()
                .filter(desk -> !booked.contains(desk.getId()))
                .min(Comparator
                        .comparingInt((Space desk) -> Math.abs(desk.getRowLabel().charAt(0) - lost.getRowLabel().charAt(0)))
                        .thenComparingInt(desk -> Math.abs(desk.getSeatNumber() - lost.getSeatNumber()))
                        .thenComparing(Space::getRowLabel)
                        .thenComparing(Space::getSeatNumber))
                .map(desk -> List.of(new ErrorDetail("suggestedSpaceId", String.valueOf(desk.getId())),
                        new ErrorDetail("suggestedLabel", desk.label())))
                .orElse(List.of());
    }

    // ---- Helpers ----

    /** Locks the spaces one by one in ascending id order (always the same order: no deadlock). */
    private Map<Long, Space> lockSpacesInOrder(long... ids) {
        Map<Long, Space> locked = new HashMap<>();
        Set<Long> ordered = new TreeSet<>();
        for (long id : ids) {
            if (id != 0) {
                ordered.add(id);
            }
        }
        for (Long id : ordered) {
            Optional<Space> space = spaces.lockById(id);
            space.ifPresent(found -> locked.put(id, found));
        }
        return locked;
    }

    /** Takes the booking row lock and returns the booking, or 404 if it isn't this person's. */
    private Booking lockOwnBooking(Long bookingId, Long userId) {
        return bookings.lockById(bookingId)
                .filter(booking -> booking.getUserId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Booking"));
    }

    private static ApiException invalidStatus(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_STATUS", message);
    }

    private static ApiException tooLateToCheckIn(Booking booking, ZoneId zone, String what) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "CHECK_IN_CLOSED",
                "Too late to check in. Check-in closed at " + TimeText.clock(booking.checkInClosesAt(), zone)
                        + ", so the " + what + " went back to your team.");
    }

    private static String firstName(User user) {
        String name = user.displayName();
        int space = name.indexOf(' ');
        return space > 0 ? name.substring(0, space) : name;
    }
}
