package com.deskhive.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.deskhive.auth.AuthService;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserStatus;

/**
 * Creates an Admin. Admins are never created through the app: public sign-up doesn't exist and an
 * invitation always creates an Employee. Run with scripts\seed.ps1 -Seed admin -Email you@company.com
 * -Name "Your Name"; the password is ADMIN_PASSWORD in the env file or the environment (at least 8
 * characters with a number). It works on any database, including production, and never overwrites an
 * existing account.
 */
@Component
@Profile("seed-admin")
public class SeedAdminRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedAdminRunner.class);

    private final SeedSupport seed;
    private final Environment env;

    public SeedAdminRunner(SeedSupport seed, Environment env) {
        this.seed = seed;
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed.runAndExit("Admin seed", () -> createAdmin(args), log);
    }

    private void createAdmin(ApplicationArguments args) {
        String email = option(args, "email");
        String name = option(args, "name");
        String password = env.getProperty("ADMIN_PASSWORD");
        if (email == null || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("Pass --email you@company.com");
        }
        if (name == null || name.isBlank() || name.length() > 80) {
            throw new IllegalArgumentException("Pass --name \"Your Name\" (1 to 80 characters)");
        }
        if (password == null || password.length() < 8 || !password.matches(".*\\d.*") || password.length() > 72) {
            throw new IllegalArgumentException("Set ADMIN_PASSWORD (8 to 72 characters, with a number)");
        }
        String normalized = AuthService.normalizeEmail(email);
        if (seed.users().existsByEmail(normalized)) {
            throw new IllegalStateException("An account with that email already exists");
        }
        // No office yet: the first Admin sets up the first office in the app.
        seed.users().save(new User(name.trim(), normalized, seed.passwordEncoder().encode(password), Role.ADMIN,
                UserStatus.ACTIVE, null));
        log.info("Admin created (log in with that email and ADMIN_PASSWORD)");
    }

    private static String option(ApplicationArguments args, String name) {
        return args.containsOption(name) && !args.getOptionValues(name).isEmpty() ? args.getOptionValues(name).get(0) : null;
    }
}
