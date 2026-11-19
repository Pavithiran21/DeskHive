package com.deskhive.office;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.common.web.PageQuery;
import com.deskhive.common.web.PageResponse;
import com.deskhive.office.OfficeDtos.DeskRequest;
import com.deskhive.office.OfficeDtos.RoomRequest;
import com.deskhive.office.OfficeDtos.SpaceResponse;
import com.deskhive.user.CurrentUser;

import jakarta.validation.Valid;

/** Admin: the Spaces and seats table, desks and rooms. The service checks the Admin role first. */
@RestController
@RequestMapping("/api/admin")
public class AdminSpaceController {

    private final SpaceService spaceService;

    public AdminSpaceController(SpaceService spaceService) {
        this.spaceService = spaceService;
    }

    /** The table for one floor: optional type (DESK or ROOM) and a search text, paginated. */
    @GetMapping("/spaces")
    public PageResponse<SpaceResponse> search(CurrentUser actor, @RequestParam Long floorId,
            @RequestParam(required = false) SpaceType type, @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return spaceService.search(actor, floorId, type, q, PageQuery.unsorted(page, size));
    }

    @GetMapping("/spaces/{id}")
    public SpaceResponse get(CurrentUser actor, @PathVariable Long id) {
        return spaceService.get(actor, id);
    }

    @PostMapping("/desks")
    @ResponseStatus(HttpStatus.CREATED)
    public SpaceResponse createDesk(CurrentUser actor, @Valid @RequestBody DeskRequest body) {
        return spaceService.createDesk(actor, body);
    }

    @PutMapping("/desks/{id}")
    public SpaceResponse updateDesk(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody DeskRequest body) {
        return spaceService.updateDesk(actor, id, body);
    }

    @PostMapping("/rooms")
    @ResponseStatus(HttpStatus.CREATED)
    public SpaceResponse createRoom(CurrentUser actor, @Valid @RequestBody RoomRequest body) {
        return spaceService.createRoom(actor, body);
    }

    @PutMapping("/rooms/{id}")
    public SpaceResponse updateRoom(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody RoomRequest body) {
        return spaceService.updateRoom(actor, id, body);
    }

    /** Works for a desk or a room. */
    @DeleteMapping("/spaces/{id}")
    public ResponseEntity<Void> delete(CurrentUser actor, @PathVariable Long id) {
        spaceService.delete(actor, id);
        return ResponseEntity.noContent().build();
    }
}
