package com.deskhive.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.booking.Booking;
import com.deskhive.booking.BookingRepository;
import com.deskhive.booking.BookingStatus;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.web.PageResponse;
import com.deskhive.office.Floor;
import com.deskhive.office.FloorRepository;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.Space;
import com.deskhive.office.SpaceRepository;
import com.deskhive.office.SpaceType;
import com.deskhive.report.OccupancyDtos.DayCount;
import com.deskhive.report.OccupancyDtos.Kpis;
import com.deskhive.report.OccupancyDtos.OccupancyResponse;
import com.deskhive.report.OccupancyDtos.SpaceUse;
import com.deskhive.user.CurrentUser;

/**
 * The Admin's occupancy report. The week is Monday to Sunday and every office is open all 7 days
 * (PRODUCT.md). Days come from bookings.booking_date, which already is the office-local day, so no time zone
 * maths is needed here. The week's bookings are loaded once and counted in memory: a week of one office is
 * a few hundred rows at most, and the arithmetic stays easy to read and explain.
 */
@Service
public class OccupancyService {

    private static final int OPEN_DAYS = 7;
    private static final BigDecimal MINUTES_PER_HOUR = BigDecimal.valueOf(60);

    private final OfficeRepository offices;
    private final FloorRepository floors;
    private final SpaceRepository spaces;
    private final BookingRepository bookings;
    private final Clock clock;

    public OccupancyService(OfficeRepository offices, FloorRepository floors, SpaceRepository spaces,
            BookingRepository bookings, Clock clock) {
        this.offices = offices;
        this.floors = floors;
        this.spaces = spaces;
        this.bookings = bookings;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public OccupancyResponse report(CurrentUser actor, Long officeId, Long floorId, LocalDate anyDayOfWeek, Pageable pageable) {
        actor.requireAdmin();
        Office office = offices.findById(officeId).orElseThrow(() -> ApiException.notFound("Office"));
        Floor floor = null;
        if (floorId != null) {
            floor = floors.findById(floorId).orElseThrow(() -> ApiException.notFound("Floor"));
            if (!floor.getOfficeId().equals(officeId)) {
                throw ApiException.invalidField("floorId", "That floor isn't at this office.");
            }
        }
        LocalDate today = clock.instant().atZone(office.zone()).toLocalDate();
        LocalDate monday = (anyDayOfWeek == null ? today : anyDayOfWeek).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        Map<Long, Floor> floorById = new HashMap<>();
        floors.findByOfficeIdOrderByNameAsc(officeId).forEach(found -> floorById.put(found.getId(), found));
        List<Space> allSpaces = floorId == null ? spaces.findByOfficeId(officeId) : spaces.findByFloorId(floorId);
        List<Space> desks = allSpaces.stream().filter(Space::isDesk).toList();
        List<Space> rooms = allSpaces.stream().filter(space -> !space.isDesk()).toList();

        // Bookings of spaces that still exist; a deleted space has no desk or room to measure against.
        List<Booking> week = bookings.findForReport(officeId, floorId, monday, sunday).stream()
                .filter(booking -> booking.getSpaceId() != null).toList();
        List<Booking> active = week.stream().filter(booking -> BookingStatus.ACTIVE.contains(booking.getStatus())).toList();
        List<Booking> released = week.stream().filter(booking -> booking.getStatus() == BookingStatus.AUTO_RELEASED).toList();

        // Desk use: distinct (desk, day) pairs with an active booking.
        Set<String> deskDays = new HashSet<>();
        Map<LocalDate, Set<Long>> desksByDay = new HashMap<>();
        for (Booking booking : active) {
            if (booking.getSpaceType() == SpaceType.DESK) {
                deskDays.add(booking.getSpaceId() + "@" + booking.getBookingDate());
                desksByDay.computeIfAbsent(booking.getBookingDate(), day -> new HashSet<>()).add(booking.getSpaceId());
            }
        }
        long deskDaysAvailable = (long) desks.size() * OPEN_DAYS;

        // Room use: booked hours over rooms x open hours x 7.
        BigDecimal roomHoursBooked = hours(active.stream().filter(b -> b.getSpaceType() == SpaceType.ROOM)
                .map(b -> Duration.between(b.getStartAt(), b.getEndAt())).reduce(Duration.ZERO, Duration::plus));
        BigDecimal roomHoursAvailable = hours(office.openLength().multipliedBy((long) rooms.size() * OPEN_DAYS));

        List<DayCount> byDay = new ArrayList<>();
        LocalDate busiest = null;
        long busiestCount = 0;
        for (int i = 0; i < OPEN_DAYS; i++) {
            LocalDate day = monday.plusDays(i);
            long count = desksByDay.getOrDefault(day, Set.of()).size();
            byDay.add(new DayCount(day, count));
            if (count > busiestCount) {
                busiest = day;
                busiestCount = count;
            }
        }

        Kpis kpis = new Kpis(percent(BigDecimal.valueOf(deskDays.size()), BigDecimal.valueOf(deskDaysAvailable)),
                deskDays.size(), deskDaysAvailable, percent(roomHoursBooked, roomHoursAvailable), roomHoursBooked,
                roomHoursAvailable, released.size(), busiest, busiestCount, active.size());

        PageResponse<SpaceUse> bySpace = bySpace(allSpaces, floorById, office, active, released, pageable);
        return new OccupancyResponse(office.getId(), office.getName(), floor == null ? null : floor.getId(),
                floor == null ? null : floor.getName(), office.getTimeZone(), monday, sunday, desks.size(), rooms.size(),
                kpis, byDay, bySpace);
    }

    /** One row per desk and room, busiest first, paginated in memory. */
    private PageResponse<SpaceUse> bySpace(List<Space> allSpaces, Map<Long, Floor> floorById, Office office,
            List<Booking> active, List<Booking> released, Pageable pageable) {
        Map<Long, List<Booking>> activeBySpace = new HashMap<>();
        active.forEach(booking -> activeBySpace.computeIfAbsent(booking.getSpaceId(), id -> new ArrayList<>()).add(booking));
        Map<Long, Long> noShowsBySpace = new HashMap<>();
        released.forEach(booking -> noShowsBySpace.merge(booking.getSpaceId(), 1L, Long::sum));

        List<SpaceUse> rows = new ArrayList<>();
        for (Space space : allSpaces) {
            List<Booking> mine = activeBySpace.getOrDefault(space.getId(), List.of());
            BigDecimal units;
            BigDecimal available;
            if (space.isDesk()) {
                units = BigDecimal.valueOf(mine.stream().map(Booking::getBookingDate).distinct().count());
                available = BigDecimal.valueOf(OPEN_DAYS);
            } else {
                units = hours(mine.stream().map(b -> Duration.between(b.getStartAt(), b.getEndAt())).reduce(Duration.ZERO, Duration::plus));
                available = hours(office.openLength().multipliedBy(OPEN_DAYS));
            }
            Floor floor = floorById.get(space.getFloorId());
            rows.add(new SpaceUse(space.getId(), space.getType(), space.label(), floor == null ? null : floor.getName(),
                    mine.size(), units, percent(units, available), noShowsBySpace.getOrDefault(space.getId(), 0L)));
        }
        rows.sort(Comparator.comparing((SpaceUse row) -> row.use() == null ? BigDecimal.ZERO : row.use()).reversed()
                .thenComparing(SpaceUse::label));

        int from = (int) Math.min(pageable.getOffset(), rows.size());
        int to = Math.min(from + pageable.getPageSize(), rows.size());
        int totalPages = (int) Math.ceil(rows.size() / (double) pageable.getPageSize());
        return new PageResponse<>(rows.subList(from, to), pageable.getPageNumber() + 1, pageable.getPageSize(), rows.size(), totalPages);
    }

    /** part / whole as a percentage with one decimal, or null when the whole is zero. */
    private static BigDecimal percent(BigDecimal part, BigDecimal whole) {
        if (whole.signum() == 0) {
            return null;
        }
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal hours(Duration duration) {
        return BigDecimal.valueOf(duration.toMinutes()).divide(MINUTES_PER_HOUR, 1, RoundingMode.HALF_UP);
    }
}
