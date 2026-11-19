package com.deskhive.admin;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.admin.PeopleDtos.PersonRow;
import com.deskhive.common.web.PageQuery;
import com.deskhive.common.web.PageResponse;
import com.deskhive.invitation.InvitationDtos.InviteRequest;
import com.deskhive.user.CurrentUser;

import jakarta.validation.Valid;

/** Admin: people and invitations. Every service method checks the Admin role first. */
@RestController
@RequestMapping("/api/admin")
public class PeopleController {

    private static final List<String> SORT_FIELDS = List.of("name", "email", "createdAt");

    private final PeopleService peopleService;

    public PeopleController(PeopleService peopleService) {
        this.peopleService = peopleService;
    }

    @GetMapping("/people")
    public PageResponse<PersonRow> list(CurrentUser actor, @RequestParam(required = false) Long officeId,
            @RequestParam(required = false) String q, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size, @RequestParam(required = false) String sort) {
        return peopleService.list(actor, officeId, q, PageQuery.toPageable(page, size, sort, SORT_FIELDS, "name"));
    }

    @PostMapping("/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public PersonRow invite(CurrentUser actor, @Valid @RequestBody InviteRequest body) {
        return peopleService.invite(actor, body.email(), body.officeId());
    }

    @PostMapping("/invitations/{id}/resend")
    public PersonRow resend(CurrentUser actor, @PathVariable Long id) {
        return peopleService.resend(actor, id);
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> revoke(CurrentUser actor, @PathVariable Long id) {
        peopleService.revoke(actor, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/people/{id}/remove")
    public PersonRow remove(CurrentUser actor, @PathVariable Long id) {
        return peopleService.removeAccess(actor, id);
    }
}
