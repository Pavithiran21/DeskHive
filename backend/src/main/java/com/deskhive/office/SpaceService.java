package com.deskhive.office;

import java.time.Clock;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.booking.BookingRepository;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.error.ErrorDetail;
import com.deskhive.common.web.PageResponse;
import com.deskhive.office.OfficeDtos.DeskRequest;
import com.deskhive.office.OfficeDtos.RoomRequest;
import com.deskhive.office.OfficeDtos.SpaceResponse;
import com.deskhive.user.CurrentUser;

/**
 * Desks and rooms: create, edit, delete and the Spaces and seats table. Admin only (checked first in
 * every method). A floor row is locked while spaces are added or moved, and a space row while it is
 * edited or deleted, so these can't pass each other (and a delete can't slip past a new booking, which
 * also locks the space row).
 */
@Service
public class SpaceService {

    private final SpaceRepository spaces;
    private final FloorRepository floors;
    private final BookingRepository bookings;
    private final Clock clock;

    public SpaceService(SpaceRepository spaces, FloorRepository floors, BookingRepository bookings, Clock clock) {
        this.spaces = spaces;
        this.floors = floors;
        this.bookings = bookings;
        this.clock = clock;
    }

    // ---- Desks ----

    @Transactional
    public SpaceResponse createDesk(CurrentUser actor, DeskRequest request) {
        actor.requireAdmin();
        Floor floor = floors.lockById(request.floorId()).orElseThrow(() -> ApiException.invalidField("floorId", "Pick a floor."));
        String row = request.row().toUpperCase(Locale.ROOT);
        Set<Feature> features = checkFeatures(request.features(), SpaceType.DESK);
        if (spaces.existsByFloorIdAndRowLabelAndSeatNumber(floor.getId(), row, request.number())) {
            throw deskTaken(row, request.number(), floor);
        }
        Space desk = Space.desk(floor.getId(), request.area().trim(), row, request.number(), features);
        return save(desk, floor, deskTaken(row, request.number(), floor));
    }

    @Transactional
    public SpaceResponse updateDesk(CurrentUser actor, Long id, DeskRequest request) {
        actor.requireAdmin();
        Space desk = lockSpace(id, SpaceType.DESK);
        Floor floor = targetFloor(desk, request.floorId());
        String row = request.row().toUpperCase(Locale.ROOT);
        Set<Feature> features = checkFeatures(request.features(), SpaceType.DESK);
        if (spaces.existsByFloorIdAndRowLabelAndSeatNumberAndIdNot(floor.getId(), row, request.number(), id)) {
            throw deskTaken(row, request.number(), floor);
        }
        desk.setFloorId(floor.getId());
        desk.setArea(request.area().trim());
        desk.setRowLabel(row);
        desk.setSeatNumber(request.number());
        desk.setFeatures(features);
        return save(desk, floor, deskTaken(row, request.number(), floor));
    }

    // ---- Rooms ----

    @Transactional
    public SpaceResponse createRoom(CurrentUser actor, RoomRequest request) {
        actor.requireAdmin();
        Floor floor = floors.lockById(request.floorId()).orElseThrow(() -> ApiException.invalidField("floorId", "Pick a floor."));
        String name = request.name().trim();
        Set<Feature> features = checkFeatures(request.features(), SpaceType.ROOM);
        if (spaces.existsByFloorIdAndName(floor.getId(), name)) {
            throw roomTaken(name, floor);
        }
        return save(Space.room(floor.getId(), name, request.capacity(), features), floor, roomTaken(name, floor));
    }

    @Transactional
    public SpaceResponse updateRoom(CurrentUser actor, Long id, RoomRequest request) {
        actor.requireAdmin();
        Space room = lockSpace(id, SpaceType.ROOM);
        Floor floor = targetFloor(room, request.floorId());
        String name = request.name().trim();
        Set<Feature> features = checkFeatures(request.features(), SpaceType.ROOM);
        if (spaces.existsByFloorIdAndNameAndIdNot(floor.getId(), name, id)) {
            throw roomTaken(name, floor);
        }
        room.setFloorId(floor.getId());
        room.setName(name);
        room.setCapacity(request.capacity());
        room.setFeatures(features);
        return save(room, floor, roomTaken(name, floor));
    }

    // ---- Delete, read ----

    /**
     * Refused while the space has upcoming bookings. Past bookings stay in the reports: they keep the
     * label, floor and office as snapshots, and the database sets their space_id to NULL.
     */
    @Transactional
    public void delete(CurrentUser actor, Long id) {
        actor.requireAdmin();
        Space space = spaces.lockById(id).orElseThrow(() -> ApiException.notFound("Space"));
        long upcoming = bookings.countUpcomingForSpace(id, clock.instant());
        if (upcoming > 0) {
            throw OfficeService.hasDependents("Can't delete " + space.label() + " yet. It has " + upcoming
                    + (upcoming == 1 ? " upcoming booking" : " upcoming bookings")
                    + ". Cancel " + (upcoming == 1 ? "it" : "them") + " in All bookings first.");
        }
        spaces.delete(space);
    }

    @Transactional(readOnly = true)
    public PageResponse<SpaceResponse> search(CurrentUser actor, Long floorId, SpaceType type, String q, Pageable pageable) {
        actor.requireAdmin();
        Floor floor = floors.findById(floorId).orElseThrow(() -> ApiException.notFound("Floor"));
        String pattern = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
        Page<Space> page = spaces.search(floorId, type, pattern, pageable);
        return new PageResponse<>(page.getContent().stream().map(space -> toResponse(space, floor)).toList(),
                page.getNumber() + 1, page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    @Transactional(readOnly = true)
    public SpaceResponse get(CurrentUser actor, Long id) {
        actor.requireAdmin();
        Space space = spaces.findById(id).orElseThrow(() -> ApiException.notFound("Space"));
        return toResponse(space, floors.findById(space.getFloorId()).orElseThrow());
    }


    // ---- Helpers ----

    private Space lockSpace(Long id, SpaceType type) {
        Space space = spaces.lockById(id).orElseThrow(() -> ApiException.notFound("Space"));
        if (space.getType() != type) {
            throw ApiException.notFound(type == SpaceType.DESK ? "Desk" : "Room");
        }
        return space;
    }

    /** The floor to save the space on. Moving it to another office would break its bookings, so that is refused. */
    private Floor targetFloor(Space space, Long floorId) {
        Floor current = floors.findById(space.getFloorId()).orElseThrow();
        if (floorId.equals(current.getId())) {
            return current;
        }
        Floor target = floors.lockById(floorId).orElseThrow(() -> ApiException.invalidField("floorId", "Pick a floor."));
        if (!target.getOfficeId().equals(current.getOfficeId())) {
            throw ApiException.invalidField("floorId", "Pick a floor at the same office.");
        }
        return target;
    }

    private SpaceResponse save(Space space, Floor floor, ApiException duplicate) {
        try {
            return toResponse(spaces.saveAndFlush(space), floor);
        } catch (DataIntegrityViolationException ex) {
            throw OfficeService.duplicateOr(ex, duplicate);
        }
    }

    private static Set<Feature> checkFeatures(Set<Feature> requested, SpaceType type) {
        Set<Feature> features = EnumSet.noneOf(Feature.class);
        if (requested != null) {
            features.addAll(requested);
        }
        Set<Feature> allowed = Feature.allowedFor(type);
        if (!allowed.containsAll(features)) {
            throw ApiException.invalidField("features", "Pick from: " + allowed.stream().map(Enum::name)
                    .collect(Collectors.joining(", ")) + ".");
        }
        return features;
    }

    static SpaceResponse toResponse(Space space, Floor floor) {
        return new SpaceResponse(space.getId(), space.getType(), floor.getId(), floor.getName(), floor.getOfficeId(),
                space.label(), space.getArea(), space.getRowLabel(), space.getSeatNumber(), space.getName(),
                space.getCapacity(), space.getFeatures());
    }

    private static ApiException deskTaken(String row, int number, Floor floor) {
        String message = row + number + " already exists on " + floor.getName() + ". Pick another number.";
        return new ApiException(HttpStatus.CONFLICT, "SPACE_EXISTS", message, List.of(new ErrorDetail("number", message)));
    }

    private static ApiException roomTaken(String name, Floor floor) {
        String message = "A room named " + name + " already exists on " + floor.getName() + ".";
        return new ApiException(HttpStatus.CONFLICT, "SPACE_EXISTS", message, List.of(new ErrorDetail("name", message)));
    }
}
