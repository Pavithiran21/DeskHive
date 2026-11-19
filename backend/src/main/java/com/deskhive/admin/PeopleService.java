package com.deskhive.admin;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.admin.PeopleDtos.PersonRow;
import com.deskhive.admin.PeopleDtos.PersonStatus;
import com.deskhive.auth.PasswordResetTokenRepository;
import com.deskhive.auth.RefreshTokenRepository;
import com.deskhive.booking.BookingRepository;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.web.PageResponse;
import com.deskhive.invitation.Invitation;
import com.deskhive.invitation.InvitationRepository;
import com.deskhive.invitation.InvitationService;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.user.CurrentUser;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserStatus;

/** The People and invites screen: the list, invite, resend, revoke and Remove access. Admin only. */
@Service
public class PeopleService {

    private final UserRepository users;
    private final InvitationRepository invitations;
    private final InvitationService invitationService;
    private final OfficeRepository offices;
    private final BookingRepository bookings;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final Clock clock;

    public PeopleService(UserRepository users, InvitationRepository invitations, InvitationService invitationService,
            OfficeRepository offices, BookingRepository bookings, RefreshTokenRepository refreshTokens,
            PasswordResetTokenRepository resetTokens, Clock clock) {
        this.users = users;
        this.invitations = invitations;
        this.invitationService = invitationService;
        this.offices = offices;
        this.bookings = bookings;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<PersonRow> list(CurrentUser actor, Long officeId, String q, Pageable pageable) {
        actor.requireAdmin();
        String pattern = q == null || q.isBlank() ? null : "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
        Page<User> page = users.searchPeople(officeId, pattern, pageable);
        return new PageResponse<>(rows(page.getContent()), page.getNumber() + 1, page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }

    /** Invites an email to an office and returns the new person's row ("Invite pending"). */
    public PersonRow invite(CurrentUser actor, String email, Long officeId) {
        Long invitationId = invitationService.invite(actor, email, officeId);
        return rowForInvitation(invitationId);
    }

    public PersonRow resend(CurrentUser actor, Long invitationId) {
        Long newId = invitationService.resend(actor, invitationId);
        return rowForInvitation(newId);
    }

    public void revoke(CurrentUser actor, Long invitationId) {
        invitationService.revoke(actor, invitationId);
    }

    /**
     * Remove access: the account becomes REMOVED (final in the MVP), every login stops working, and the
     * person's upcoming bookings are cancelled. Past bookings keep their name, shown with a "Removed" tag.
     * Only active Employees can be removed (not Admins, not demo accounts).
     */
    @Transactional
    public PersonRow removeAccess(CurrentUser actor, Long userId) {
        actor.requireAdmin();
        User user = users.lockById(userId).filter(found -> found.getStatus() != UserStatus.DELETED)
                .orElseThrow(() -> ApiException.notFound("Person"));
        if (user.isDemo()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "DEMO_ACCOUNT_LOCKED", "Demo accounts can't be removed.");
        }
        if (user.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ADMIN_NOT_REMOVABLE",
                    "Admins can't be removed here. They are managed by the seed script.");
        }
        if (user.getStatus() == UserStatus.INVITED) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_STATUS",
                    "This person hasn't accepted the invitation yet. Revoke the invitation instead.");
        }
        if (user.getStatus() == UserStatus.REMOVED) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "INVALID_STATUS", "Their access was already removed.");
        }
        user.setStatus(UserStatus.REMOVED);
        refreshTokens.deleteAllForUser(userId);
        resetTokens.deleteAllForUser(userId);
        bookings.cancelUpcomingForUser(userId, actor.id(), "Access removed by an admin", clock.instant());
        return rows(List.of(user)).get(0);
    }

    // ---- Helpers ----

    private PersonRow rowForInvitation(Long invitationId) {
        Invitation invitation = invitations.findById(invitationId).orElseThrow();
        User user = users.findById(invitation.getUserId()).orElseThrow();
        return rows(List.of(user)).get(0);
    }

    /** Adds the invitation state, the office name and "bookings this week" to a page of people. */
    private List<PersonRow> rows(List<User> people) {
        Instant now = clock.instant();
        Set<Long> ids = new HashSet<>();
        Set<Long> officeIds = new HashSet<>();
        for (User user : people) {
            ids.add(user.getId());
            if (user.getOfficeId() != null) {
                officeIds.add(user.getOfficeId());
            }
        }

        Map<Long, Invitation> latestInvitation = new HashMap<>();
        for (Invitation invitation : invitations.findByUserIdInOrderByIdDesc(ids)) {
            latestInvitation.putIfAbsent(invitation.getUserId(), invitation);
        }
        Map<Long, Office> officeById = new HashMap<>();
        offices.findAllById(officeIds).forEach(office -> officeById.put(office.getId(), office));
        Map<Long, Long> weekCounts = bookingsThisWeek(people, officeById, now);

        return people.stream().map(user -> {
            Invitation invitation = user.getStatus() == UserStatus.INVITED ? latestInvitation.get(user.getId()) : null;
            PersonStatus status = switch (user.getStatus()) {
                case ACTIVE -> PersonStatus.ACTIVE;
                case REMOVED -> PersonStatus.REMOVED;
                default -> invitation != null && invitation.isUsable(now) ? PersonStatus.INVITE_PENDING : PersonStatus.INVITE_EXPIRED;
            };
            boolean canRemove = user.getStatus() == UserStatus.ACTIVE && !user.isAdmin() && !user.isDemo();
            String lockedReason = user.isAdmin() ? "SEED_ONLY" : user.isDemo() ? "DEMO" : null;
            Office office = user.getOfficeId() == null ? null : officeById.get(user.getOfficeId());
            return new PersonRow(user.getId(), user.getName(), user.getEmail(), user.getRole(), status,
                    invitation == null ? null : invitation.getId(), invitation == null ? null : invitation.getExpiresAt(),
                    user.getOfficeId(), office == null ? null : office.getName(),
                    weekCounts.getOrDefault(user.getId(), 0L), user.isDemo(), canRemove, lockedReason);
        }).toList();
    }

    /**
     * Active bookings this week (Monday to Sunday) per person. "This week" is the week of today in the
     * person's own office's time zone (UTC for an Admin who has no office yet), so one query per office.
     */
    private Map<Long, Long> bookingsThisWeek(List<User> people, Map<Long, Office> officeById, Instant now) {
        Map<Long, List<Long>> idsByOffice = new HashMap<>();
        for (User user : people) {
            idsByOffice.computeIfAbsent(user.getOfficeId() == null ? 0L : user.getOfficeId(), key -> new java.util.ArrayList<>())
                    .add(user.getId());
        }
        Map<Long, Long> counts = new HashMap<>();
        idsByOffice.forEach((officeId, ids) -> {
            ZoneId zone = officeId == 0L || officeById.get(officeId) == null ? ZoneOffset.UTC : officeById.get(officeId).zone();
            LocalDate monday = now.atZone(zone).toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            for (Object[] row : bookings.countActiveByUser(ids, monday, monday.plusDays(6))) {
                counts.put((Long) row[0], (Long) row[1]);
            }
        });
        return counts;
    }
}
