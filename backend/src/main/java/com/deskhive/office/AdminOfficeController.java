package com.deskhive.office;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.office.OfficeDtos.CreateFloorRequest;
import com.deskhive.office.OfficeDtos.CreateOfficeRequest;
import com.deskhive.office.OfficeDtos.FloorSummary;
import com.deskhive.office.OfficeDtos.OfficeResponse;
import com.deskhive.office.OfficeDtos.RenameFloorRequest;
import com.deskhive.office.OfficeDtos.RulesRequest;
import com.deskhive.office.OfficeDtos.UpdateOfficeRequest;
import com.deskhive.user.CurrentUser;

import jakarta.validation.Valid;

/** Admin: offices, their booking rules and their floors. The service checks the Admin role first. */
@RestController
@RequestMapping("/api/admin")
public class AdminOfficeController {

    private final OfficeService officeService;

    public AdminOfficeController(OfficeService officeService) {
        this.officeService = officeService;
    }

    @PostMapping("/offices")
    @ResponseStatus(HttpStatus.CREATED)
    public OfficeResponse createOffice(CurrentUser actor, @Valid @RequestBody CreateOfficeRequest body) {
        return officeService.create(actor, body);
    }

    @PatchMapping("/offices/{id}")
    public OfficeResponse updateOffice(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody UpdateOfficeRequest body) {
        return officeService.update(actor, id, body);
    }

    @PutMapping("/offices/{id}/rules")
    public OfficeResponse setRules(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody RulesRequest body) {
        return officeService.setRules(actor, id, body);
    }

    @DeleteMapping("/offices/{id}")
    public ResponseEntity<Void> deleteOffice(CurrentUser actor, @PathVariable Long id) {
        officeService.delete(actor, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/floors")
    @ResponseStatus(HttpStatus.CREATED)
    public FloorSummary createFloor(CurrentUser actor, @Valid @RequestBody CreateFloorRequest body) {
        return officeService.createFloor(actor, body);
    }

    @PatchMapping("/floors/{id}")
    public FloorSummary renameFloor(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody RenameFloorRequest body) {
        return officeService.renameFloor(actor, id, body);
    }

    @DeleteMapping("/floors/{id}")
    public ResponseEntity<Void> deleteFloor(CurrentUser actor, @PathVariable Long id) {
        officeService.deleteFloor(actor, id);
        return ResponseEntity.noContent().build();
    }
}
