package com.deskhive.invitation;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.auth.AuthCookies;
import com.deskhive.auth.AuthDtos.AuthResponse;
import com.deskhive.auth.AuthSession;
import com.deskhive.invitation.InvitationDtos.AcceptInvitationRequest;
import com.deskhive.invitation.InvitationDtos.InvitationInfo;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** Public: the person who was invited opens the emailed link, then creates their account. */
@RestController
@RequestMapping("/api/invitations")
public class InvitationController {

    private final InvitationService invitationService;
    private final AuthCookies cookies;

    public InvitationController(InvitationService invitationService, AuthCookies cookies) {
        this.invitationService = invitationService;
        this.cookies = cookies;
    }

    @GetMapping("/{token}")
    public InvitationInfo lookup(@PathVariable String token, HttpServletRequest request) {
        return invitationService.lookup(token, request.getRemoteAddr());
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<AuthResponse> accept(@PathVariable String token, @Valid @RequestBody AcceptInvitationRequest body,
            HttpServletRequest request) {
        AuthSession session = invitationService.accept(token, body.name(), body.password(), request.getRemoteAddr());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookies.create(session.refreshToken()))
                .body(new AuthResponse(session.user(), session.accessToken()));
    }
}
