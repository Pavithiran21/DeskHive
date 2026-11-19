package com.deskhive.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.springframework.stereotype.Service;

import com.deskhive.config.AppProperties;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserResponse;
import com.deskhive.user.UserResponse.OfficeBrief;
import com.deskhive.user.UserStatus;

/** Starts a login for a user: a new refresh token row plus a 15-minute access token. */
@Service
public class SessionService {

    public static final Duration REFRESH_LIFETIME = Duration.ofDays(7);

    private final RefreshTokenRepository refreshTokens;
    private final AccessTokenService accessTokens;
    private final UserRepository users;
    private final OfficeRepository offices;
    private final AppProperties props;
    private final Clock clock;

    public SessionService(RefreshTokenRepository refreshTokens, AccessTokenService accessTokens, UserRepository users,
            OfficeRepository offices, AppProperties props, Clock clock) {
        this.refreshTokens = refreshTokens;
        this.accessTokens = accessTokens;
        this.users = users;
        this.offices = offices;
        this.props = props;
        this.clock = clock;
    }

    public AuthSession start(User user) {
        String refreshToken = TokenHashing.newOpaqueToken();
        Instant now = clock.instant();
        refreshTokens.save(new RefreshToken(user.getId(), TokenHashing.sha256Hex(refreshToken), now, now.plus(REFRESH_LIFETIME)));
        return new AuthSession(profileOf(user), accessTokens.create(user.getId()), refreshToken);
    }

    public UserResponse profileOf(User user) {
        OfficeBrief office = null;
        if (user.getOfficeId() != null) {
            Office found = offices.findById(user.getOfficeId()).orElse(null);
            office = found == null ? null : new OfficeBrief(found.getId(), found.getName(), found.getTimeZone());
        }
        boolean onlyAdmin = user.getRole() == Role.ADMIN && users.countByRoleAndStatus(Role.ADMIN, UserStatus.ACTIVE) <= 1;
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), office, user.isDemo(),
                onlyAdmin, props.companyName());
    }
}
