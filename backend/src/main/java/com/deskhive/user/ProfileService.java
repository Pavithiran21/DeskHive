package com.deskhive.user;

import java.time.Clock;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.auth.AuthSession;
import com.deskhive.auth.PasswordResetTokenRepository;
import com.deskhive.auth.RefreshTokenRepository;
import com.deskhive.auth.SessionService;
import com.deskhive.booking.BookingRepository;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.error.ErrorDetail;
import com.deskhive.config.AppProperties;
import com.deskhive.invitation.InvitationRepository;

/** The logged-in person's own profile, password and account deletion. */
@Service
public class ProfileService {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final InvitationRepository invitations;
    private final BookingRepository bookings;
    private final SessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;
    private final Clock clock;

    public ProfileService(UserRepository users, RefreshTokenRepository refreshTokens,
            PasswordResetTokenRepository resetTokens, InvitationRepository invitations, BookingRepository bookings,
            SessionService sessions, PasswordEncoder passwordEncoder, AppProperties props, Clock clock) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.resetTokens = resetTokens;
        this.invitations = invitations;
        this.bookings = bookings;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public UserResponse get(CurrentUser actor) {
        return sessions.profileOf(load(actor));
    }

    @Transactional
    public UserResponse updateName(CurrentUser actor, String name) {
        User user = load(actor);
        user.setName(name.trim());
        return sessions.profileOf(user);
    }

    /** Logs out every other browser and returns a new login for this one. */
    @Transactional
    public AuthSession changePassword(CurrentUser actor, String currentPassword, String newPassword) {
        User user = load(actor);
        ensureNotDemo(user, "Demo accounts can't change the password.");
        checkPassword(user, currentPassword, "currentPassword");
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        refreshTokens.deleteAllForUser(user.getId());
        return sessions.start(user);
    }

    /**
     * Deletes the account by anonymising it: the name becomes "Former employee", the email an unusable
     * address, the password and every token are removed, and upcoming bookings are cancelled. The row
     * stays, so past bookings remain in the reports. The last Admin can't do this (409 LAST_ADMIN).
     */
    @Transactional
    public void deleteAccount(CurrentUser actor, String password) {
        User user = load(actor);
        ensureNotDemo(user, "Demo accounts can't be deleted.");
        checkPassword(user, password, "password");

        if (user.isAdmin()) {
            // Lock all active Admins, so two Admins deleting themselves at once can't both pass this check.
            List<User> admins = users.lockActiveAdmins();
            if (admins.size() <= 1) {
                throw new ApiException(HttpStatus.CONFLICT, "LAST_ADMIN", "You're the only admin at " + props.companyName()
                        + ", so this account can't be deleted.");
            }
        }
        bookings.cancelUpcomingForUser(user.getId(), user.getId(), "Account deleted", clock.instant());
        refreshTokens.deleteAllForUser(user.getId());
        resetTokens.deleteAllForUser(user.getId());
        invitations.deleteAllForUser(user.getId());
        user.setName(User.FORMER_EMPLOYEE);
        user.setEmail("deleted-" + user.getId() + "@deleted.deskhive.invalid");
        user.setPasswordHash(null);
        user.setStatus(UserStatus.DELETED);
    }

    private User load(CurrentUser actor) {
        return users.findById(actor.id()).filter(User::isActive).orElseThrow(ApiException::unauthenticated);
    }

    private static void ensureNotDemo(User user, String message) {
        if (user.isDemo()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "DEMO_ACCOUNT_LOCKED", message);
        }
    }

    /** 400, not 401: the frontend treats any 401 as "logged out". */
    private void checkPassword(User user, String password, String field) {
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WRONG_PASSWORD", "That password isn't right.",
                    List.of(new ErrorDetail(field, "That password isn't right.")));
        }
    }
}
