package com.deskhive.demo;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.deskhive.auth.AuthSession;
import com.deskhive.auth.SessionService;
import com.deskhive.common.error.ApiException;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserStatus;

/**
 * The /demo page, only when DEMO_MODE=true: "Log in as Employee" and "Log in as Admin". The demo
 * accounts are normal users with is_demo set, created by the seed script, so every role and permission
 * check applies to them as usual; they only can't change their password or be deleted or removed.
 *
 * The browser never sees the demo password: it sends a role and gets the same session as a log-in.
 */
@Service
@ConditionalOnBooleanProperty("app.demo-mode")
public class DemoService {

    /** Every demo address uses this reserved domain; MailService sends their emails to the demo inbox. */
    public static final String EMAIL_DOMAIN = "demo.deskhive.test";

    private final UserRepository users;
    private final SessionService sessions;

    public DemoService(UserRepository users, SessionService sessions) {
        this.users = users;
        this.sessions = sessions;
    }

    public record DemoRole(Role role, String email) {
    }

    public record DemoInfo(List<DemoRole> roles) {
    }

    public DemoInfo info() {
        return new DemoInfo(List.of(new DemoRole(Role.EMPLOYEE, emailFor(Role.EMPLOYEE)),
                new DemoRole(Role.ADMIN, emailFor(Role.ADMIN))));
    }

    @Transactional
    public AuthSession login(Role role) {
        User user = users.findByEmail(emailFor(role))
                .filter(User::isDemo)
                .filter(found -> found.getRole() == role && found.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND",
                        "The demo account is not set up. Run the demo seed first."));
        return sessions.start(user);
    }

    private static String emailFor(Role role) {
        return (role == Role.ADMIN ? "admin@" : "employee@") + EMAIL_DOMAIN;
    }
}
