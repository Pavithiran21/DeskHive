package com.deskhive.invitation;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.auth.AuthService;
import com.deskhive.auth.AuthSession;
import com.deskhive.auth.SessionService;
import com.deskhive.auth.TokenHashing;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.error.DatabaseErrors;
import com.deskhive.common.web.RateLimiter;
import com.deskhive.common.web.RateLimiter.Limit;
import com.deskhive.config.AppProperties;
import com.deskhive.invitation.InvitationDtos.InvitationInfo;
import com.deskhive.mail.MailEvents.InvitationCreated;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.user.CurrentUser;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserStatus;

/**
 * Invitations: an Admin invites an email to an office, the person opens the emailed link within 7
 * days and sets a name and password. Invitations create Employees only; Admins come from the seed script.
 *
 * An invited person is a row in users with status INVITED and no password. Accepting makes it ACTIVE.
 * The link works once: {@link InvitationRepository#markUsed} is a single conditional UPDATE, so two
 * requests with the same link can't both succeed. Every dead link (expired, revoked, used, unknown)
 * gives the same answer, so nobody learns which of them it was.
 */
@Service
public class InvitationService {

    public static final Duration LINK_LIFETIME = Duration.ofDays(7);
    private static final Pattern TOKEN_FORMAT = Pattern.compile("^[A-Za-z0-9_-]{43}$");

    private final UserRepository users;
    private final InvitationRepository invitations;
    private final OfficeRepository offices;
    private final SessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final RateLimiter rateLimiter;
    private final ApplicationEventPublisher events;
    private final AppProperties props;
    private final Clock clock;

    public InvitationService(UserRepository users, InvitationRepository invitations, OfficeRepository offices,
            SessionService sessions, PasswordEncoder passwordEncoder, RateLimiter rateLimiter,
            ApplicationEventPublisher events, AppProperties props, Clock clock) {
        this.users = users;
        this.invitations = invitations;
        this.offices = offices;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiter = rateLimiter;
        this.events = events;
        this.props = props;
        this.clock = clock;
    }

    // ---- Admin: invite, resend, revoke ----

    @Transactional
    public Long invite(CurrentUser admin, String rawEmail, Long officeId) {
        admin.requireAdmin();
        Office office = offices.findById(officeId)
                .orElseThrow(() -> ApiException.invalidField("officeId", "Pick an office."));
        String email = AuthService.normalizeEmail(rawEmail);

        users.findByEmail(email).ifPresent(existing -> {
            throw switch (existing.getStatus()) {
                case INVITED -> new ApiException(HttpStatus.CONFLICT, "INVITE_PENDING",
                        "This person already has a pending invitation. Resend it instead.");
                case REMOVED -> new ApiException(HttpStatus.CONFLICT, "ACCESS_REMOVED",
                        "This person's access was removed.");
                default -> new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "That person already has an account.");
            };
        });

        // The name is a placeholder (the part before the @) until the person sets theirs.
        User invited = new User(email.substring(0, email.indexOf('@')), email, null, Role.EMPLOYEE,
                UserStatus.INVITED, office.getId());
        try {
            users.saveAndFlush(invited);
        } catch (DataIntegrityViolationException ex) {
            // Two Admins inviting the same email at the same moment: the UNIQUE index stops the second.
            if (DatabaseErrors.isDuplicateKey(ex)) {
                throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "That person already has an account.");
            }
            throw ex;
        }
        return issueLink(invited.getId(), admin.id());
    }

    /** A new link; the old ones stop working. Returns the new invitation's id. */
    @Transactional
    public Long resend(CurrentUser admin, Long invitationId) {
        admin.requireAdmin();
        Invitation current = pendingInvitation(invitationId);
        invitations.revokeAllForUser(current.getUserId(), clock.instant());
        return issueLink(current.getUserId(), admin.id());
    }

    /** Takes the pending person away completely, so the email can be invited again. */
    @Transactional
    public void revoke(CurrentUser admin, Long invitationId) {
        admin.requireAdmin();
        Invitation current = pendingInvitation(invitationId);
        invitations.deleteAllForUser(current.getUserId());
        users.deleteById(current.getUserId());
    }

    // ---- Public: look at the link, accept it ----

    @Transactional(readOnly = true)
    public InvitationInfo lookup(String token, String clientIp) {
        rateLimiter.consume(Limit.ACCEPT_INVITE, clientIp);
        Invitation invitation = usableInvitation(token);
        User invited = users.findById(invitation.getUserId()).orElseThrow(InvitationService::notValid);
        User inviter = users.findById(invitation.getInvitedBy()).orElse(null);
        Office office = offices.findById(invited.getOfficeId()).orElseThrow(InvitationService::notValid);
        return new InvitationInfo(invited.getEmail(), inviter == null ? null : inviter.displayName(), office.getName(),
                office.getTimeZone(), invitation.getExpiresAt(), props.companyName());
    }

    @Transactional
    public AuthSession accept(String token, String name, String password, String clientIp) {
        rateLimiter.consume(Limit.ACCEPT_INVITE, clientIp);
        Invitation invitation = usableInvitation(token);
        if (invitations.markUsed(invitation.getId(), clock.instant()) != 1) {
            throw notValid();
        }
        User user = users.findById(invitation.getUserId()).orElseThrow(InvitationService::notValid);
        user.setName(name.trim());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setStatus(UserStatus.ACTIVE);
        return sessions.start(user);
    }

    // ---- Helpers ----

    private Long issueLink(Long userId, Long invitedBy) {
        String token = TokenHashing.newOpaqueToken();
        Instant now = clock.instant();
        Invitation invitation = invitations.save(
                new Invitation(userId, invitedBy, TokenHashing.sha256Hex(token), now, now.plus(LINK_LIFETIME)));
        events.publishEvent(new InvitationCreated(invitation.getId(), token));
        return invitation.getId();
    }

    /** A link that works now, for a person who is still INVITED. Anything else is the one "not valid" answer. */
    private Invitation usableInvitation(String token) {
        if (token == null || !TOKEN_FORMAT.matcher(token).matches()) {
            throw notValid();
        }
        Invitation invitation = invitations.findByTokenHash(TokenHashing.sha256Hex(token)).orElseThrow(InvitationService::notValid);
        boolean personStillInvited = users.findById(invitation.getUserId())
                .map(user -> user.getStatus() == UserStatus.INVITED).orElse(false);
        if (!invitation.isUsable(clock.instant()) || !personStillInvited) {
            throw notValid();
        }
        return invitation;
    }

    /** The invitation the Admin acts on (resend, revoke): its person must still be waiting to accept. */
    private Invitation pendingInvitation(Long invitationId) {
        Invitation invitation = invitations.findById(invitationId).orElseThrow(() -> ApiException.notFound("Invitation"));
        boolean personStillInvited = users.findById(invitation.getUserId())
                .map(user -> user.getStatus() == UserStatus.INVITED).orElse(false);
        if (!personStillInvited) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_STATUS",
                    "This person already accepted the invitation.");
        }
        return invitation;
    }

    private static ApiException notValid() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVITE_NOT_VALID",
                "This invitation can't be used any more. It has expired, was revoked or was already used. "
                        + "Ask your admin to send a new one.");
    }
}
