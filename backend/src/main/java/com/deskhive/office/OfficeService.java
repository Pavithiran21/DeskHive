package com.deskhive.office;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.common.error.ApiException;
import com.deskhive.common.error.DatabaseErrors;
import com.deskhive.common.error.ErrorDetail;
import com.deskhive.common.web.TimeText;
import com.deskhive.office.OfficeDtos.CreateFloorRequest;
import com.deskhive.office.OfficeDtos.CreateOfficeRequest;
import com.deskhive.office.OfficeDtos.FloorSummary;
import com.deskhive.office.OfficeDtos.OfficeResponse;
import com.deskhive.office.OfficeDtos.RenameFloorRequest;
import com.deskhive.office.OfficeDtos.Rules;
import com.deskhive.office.OfficeDtos.RulesRequest;
import com.deskhive.office.OfficeDtos.UpdateOfficeRequest;
import com.deskhive.user.CurrentUser;
import com.deskhive.user.UserRepository;

/**
 * Offices (locations), their booking rules and their floors. Reads are open to every logged-in
 * person (the pickers need them); every write checks the Admin role first.
 */
@Service
public class OfficeService {

    private final OfficeRepository offices;
    private final FloorRepository floors;
    private final SpaceRepository spaces;
    private final UserRepository users;
    private final Clock clock;

    public OfficeService(OfficeRepository offices, FloorRepository floors, SpaceRepository spaces,
            UserRepository users, Clock clock) {
        this.offices = offices;
        this.floors = floors;
        this.spaces = spaces;
        this.users = users;
        this.clock = clock;
    }

    // ---- Reads (both roles) ----

    @Transactional(readOnly = true)
    public List<OfficeResponse> list() {
        return toResponses(offices.findAllByOrderByNameAsc());
    }

    @Transactional(readOnly = true)
    public OfficeResponse get(Long id) {
        return toResponse(offices.findById(id).orElseThrow(() -> ApiException.notFound("Office")));
    }

    // ---- Offices (Admin) ----

    @Transactional
    public OfficeResponse create(CurrentUser actor, CreateOfficeRequest request) {
        actor.requireAdmin();
        String name = request.name().trim();
        if (offices.existsByName(name)) {
            throw nameTaken(name);
        }
        Office office = new Office(name, request.address().trim(), request.timeZone());
        LocalTime opens = request.opensAt() == null ? Office.DEFAULT_OPENS : request.opensAt();
        LocalTime closes = request.closesAt() == null ? Office.DEFAULT_CLOSES : request.closesAt();
        checkOpeningHours(opens, closes);
        office.setOpensAt(opens);
        office.setClosesAt(closes);
        // The default longest booking (8 hours) can't be longer than a short day.
        if (office.openLength().compareTo(office.maxBooking()) < 0) {
            office.setMaxBookingMinutes((int) office.openLength().toMinutes());
        }
        return toResponse(save(office, name));
    }

    @Transactional
    public OfficeResponse update(CurrentUser actor, Long id, UpdateOfficeRequest request) {
        actor.requireAdmin();
        Office office = offices.findById(id).orElseThrow(() -> ApiException.notFound("Office"));
        String name = request.name().trim();
        if (offices.existsByNameAndIdNot(name, id)) {
            throw nameTaken(name);
        }
        office.setName(name);
        office.setAddress(request.address().trim());
        return toResponse(save(office, name));
    }

    /** Booking rules for new bookings. Existing bookings keep the times they were made with. */
    @Transactional
    public OfficeResponse setRules(CurrentUser actor, Long id, RulesRequest request) {
        actor.requireAdmin();
        Office office = offices.findById(id).orElseThrow(() -> ApiException.notFound("Office"));
        checkOpeningHours(request.opensAt(), request.closesAt());
        Duration open = Duration.between(request.opensAt(), request.closesAt());
        int maxMinutes = request.maxBookingHours() * 60;
        if (Duration.ofMinutes(maxMinutes).compareTo(open) > 0) {
            throw ApiException.invalidField("maxBookingHours",
                    "Can't be longer than the opening hours (" + hoursText(open) + ").");
        }
        office.setOpensAt(request.opensAt());
        office.setClosesAt(request.closesAt());
        office.setBookAheadDays(request.bookAheadDays());
        office.setMaxBookingMinutes(maxMinutes);
        return toResponse(office);
    }

    /** Refused while the office has floors or people (the message says how many). */
    @Transactional
    public void delete(CurrentUser actor, Long id) {
        actor.requireAdmin();
        Office office = offices.lockById(id).orElseThrow(() -> ApiException.notFound("Office"));
        long floorCount = floors.countByOfficeId(id);
        if (floorCount > 0) {
            throw hasDependents("Can't delete " + office.getName() + " yet. It still has " + floorCount
                    + (floorCount == 1 ? " floor" : " floors") + ". Delete its floors first.");
        }
        long people = users.countByOfficeId(id);
        if (people > 0) {
            throw hasDependents("Can't delete " + office.getName() + " yet. " + people
                    + (people == 1 ? " person belongs" : " people belong") + " to it.");
        }
        offices.delete(office);
    }

    // ---- Floors (Admin) ----

    @Transactional
    public FloorSummary createFloor(CurrentUser actor, CreateFloorRequest request) {
        actor.requireAdmin();
        // Locking the office row means a floor can't be added while the office is being deleted.
        Office office = offices.lockById(request.officeId())
                .orElseThrow(() -> ApiException.invalidField("officeId", "Pick an office."));
        String name = request.name().trim();
        if (floors.existsByOfficeIdAndName(office.getId(), name)) {
            throw floorTaken(name, office);
        }
        Floor floor = new Floor(office.getId(), name);
        try {
            floors.saveAndFlush(floor);
        } catch (DataIntegrityViolationException ex) {
            throw duplicateOr(ex, floorTaken(name, office));
        }
        return summary(floor);
    }

    @Transactional
    public FloorSummary renameFloor(CurrentUser actor, Long id, RenameFloorRequest request) {
        actor.requireAdmin();
        Floor floor = floors.findById(id).orElseThrow(() -> ApiException.notFound("Floor"));
        Office office = offices.findById(floor.getOfficeId()).orElseThrow();
        String name = request.name().trim();
        if (floors.existsByOfficeIdAndNameAndIdNot(office.getId(), name, id)) {
            throw floorTaken(name, office);
        }
        floor.setName(name);
        try {
            floors.saveAndFlush(floor);
        } catch (DataIntegrityViolationException ex) {
            throw duplicateOr(ex, floorTaken(name, office));
        }
        return summary(floor);
    }

    /** Refused while the floor has desks or rooms. */
    @Transactional
    public void deleteFloor(CurrentUser actor, Long id) {
        actor.requireAdmin();
        Floor floor = floors.lockById(id).orElseThrow(() -> ApiException.notFound("Floor"));
        long count = spaces.countByFloorId(id);
        if (count > 0) {
            throw hasDependents("Can't delete " + floor.getName() + " yet. It has " + count
                    + (count == 1 ? " desk or room" : " desks and rooms")
                    + ". Delete them or move them to another floor first.");
        }
        floors.delete(floor);
    }

    // ---- Helpers ----

    private OfficeResponse toResponse(Office office) {
        return toResponses(List.of(office)).get(0);
    }

    /**
     * Offices with their floors and desk / room counts in three queries, whatever the number of offices
     * (one per office and two per floor made the office list, which every page loads, take seconds).
     */
    private List<OfficeResponse> toResponses(List<Office> list) {
        List<Long> officeIds = list.stream().map(Office::getId).toList();
        List<Floor> allFloors = officeIds.isEmpty() ? List.of() : floors.findByOfficeIdInOrderByNameAsc(officeIds);
        Map<Long, Map<SpaceType, Long>> counts = new HashMap<>();
        if (!allFloors.isEmpty()) {
            for (Object[] row : spaces.countByFloorAndType(allFloors.stream().map(Floor::getId).toList())) {
                counts.computeIfAbsent((Long) row[0], key -> new HashMap<>()).put((SpaceType) row[1], (Long) row[2]);
            }
        }
        Map<Long, List<FloorSummary>> floorsByOffice = new HashMap<>();
        for (Floor floor : allFloors) {
            Map<SpaceType, Long> perType = counts.getOrDefault(floor.getId(), Map.of());
            floorsByOffice.computeIfAbsent(floor.getOfficeId(), key -> new ArrayList<>())
                    .add(new FloorSummary(floor.getId(), floor.getName(), perType.getOrDefault(SpaceType.DESK, 0L),
                            perType.getOrDefault(SpaceType.ROOM, 0L)));
        }
        return list.stream().map(office -> {
            Rules rules = new Rules(office.getOpensAt(), office.getClosesAt(), office.getBookAheadDays(),
                    office.getMaxBookingMinutes() / 60, true);
            return new OfficeResponse(office.getId(), office.getName(), office.getAddress(), office.getTimeZone(),
                    TimeText.zoneName(office.zone(), clock.instant()), rules, floorsByOffice.getOrDefault(office.getId(), List.of()));
        }).toList();
    }

    private FloorSummary summary(Floor floor) {
        return new FloorSummary(floor.getId(), floor.getName(), spaces.countByFloorIdAndType(floor.getId(), SpaceType.DESK),
                spaces.countByFloorIdAndType(floor.getId(), SpaceType.ROOM));
    }

    private Office save(Office office, String name) {
        try {
            return offices.saveAndFlush(office);
        } catch (DataIntegrityViolationException ex) {
            throw duplicateOr(ex, nameTaken(name));
        }
    }

    private static void checkOpeningHours(LocalTime opens, LocalTime closes) {
        for (LocalTime time : new LocalTime[] { opens, closes }) {
            if (time.getMinute() % 30 != 0 || time.getSecond() != 0 || time.getNano() != 0) {
                throw ApiException.invalidField("opensAt", "Use 30-minute steps, like 8:00 or 8:30.");
            }
        }
        if (!closes.isAfter(opens)) {
            throw ApiException.invalidField("closesAt", "The closing time must be after the opening time.");
        }
    }

    private static String hoursText(Duration open) {
        long minutes = open.toMinutes();
        return minutes % 60 == 0 ? String.valueOf(minutes / 60) : String.valueOf(minutes / 60.0);
    }

    private static ApiException nameTaken(String name) {
        return new ApiException(HttpStatus.CONFLICT, "OFFICE_EXISTS", "An office named " + name + " already exists.",
                List.of(new ErrorDetail("name", "An office named " + name + " already exists.")));
    }

    private static ApiException floorTaken(String name, Office office) {
        String message = name + " already exists at " + office.getName() + ".";
        return new ApiException(HttpStatus.CONFLICT, "FLOOR_EXISTS", message, List.of(new ErrorDetail("name", message)));
    }

    static ApiException hasDependents(String message) {
        return new ApiException(HttpStatus.CONFLICT, "HAS_DEPENDENTS", message);
    }

    /** A race with another request hit the UNIQUE index: report the friendly message, rethrow anything else. */
    static RuntimeException duplicateOr(DataIntegrityViolationException ex, ApiException friendly) {
        return DatabaseErrors.isDuplicateKey(ex) ? friendly : ex;
    }
}
