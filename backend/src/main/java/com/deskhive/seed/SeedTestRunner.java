package com.deskhive.seed;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.deskhive.office.Office;
import com.deskhive.user.Role;
import com.deskhive.user.UserStatus;

/**
 * The people the Playwright tests log in as (scripts\e2e.ps1 runs it before each pass). Tests build their
 * own offices, floors and spaces through the Admin API; only what the API can't create is seeded here:
 *  - three Admins (admin1..admin3@e2e.deskhive.test): Admins come only from a seed;
 *  - a pool of Employees (emp-0001..@e2e.deskhive.test): an invitation needs its emailed link, which is too
 *    slow for the concurrency test's 40 people. The tests hand each worker its own block of the pool, so
 *    "one desk a day" never collides between tests running in parallel;
 *  - the two demo accounts (only with DEMO_MODE=true), for the /demo page and the demo-account locks.
 * Passwords: E2E_PASSWORD (only in .env.test) for the e2e people, DEMO_PASSWORD for the demo accounts.
 * Refuses any database except "deskhive_test".
 */
@Component
@Profile("seed-test")
public class SeedTestRunner implements ApplicationRunner {

    public static final int EMPLOYEE_POOL = 4000;

    private static final Logger log = LoggerFactory.getLogger(SeedTestRunner.class);
    private static final String TEST_DATABASE = "deskhive_test";
    private static final String DOMAIN = "@e2e.deskhive.test";

    private final SeedSupport seed;
    private final JdbcTemplate jdbc;
    private final Environment env;

    public SeedTestRunner(SeedSupport seed, JdbcTemplate jdbc, Environment env) {
        this.seed = seed;
        this.jdbc = jdbc;
        this.env = env;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed.runAndExit("Test seed", this::seed, log);
    }

    private void seed() {
        seed.requireDatabase("seed-test", TEST_DATABASE);
        seed.requireDemoPassword();
        String password = env.getProperty("E2E_PASSWORD");
        if (password == null || password.length() < 8 || !password.matches(".*\\d.*")) {
            throw new IllegalStateException("Set E2E_PASSWORD (8+ characters with a number) in .env.test");
        }
        seed.wipeAll();

        Office base = seed.office("E2E Base", "1 Test Street", "Asia/Kolkata");
        // One hash for everyone: BCrypt with 12 rounds takes about 0.3 s, which 4,000 times would be 20 minutes.
        String hash = seed.passwordEncoder().encode(password);
        for (int i = 1; i <= 3; i++) {
            seed.userWithHash("E2E Admin " + i, "admin" + i + DOMAIN, hash, Role.ADMIN, base, false);
        }
        insertEmployees(base, hash);

        // The serial pass runs with DEMO_MODE=false and no demo accounts: a demo Admin can't be deleted, so with
        // one in the database the "last Admin" refusal could never be reached.
        boolean demoMode = env.getProperty("DEMO_MODE", Boolean.class, false);
        if (demoMode) {
            seed.user("Priya Raman", "employee" + SampleData.DOMAIN, Role.EMPLOYEE, UserStatus.ACTIVE, base, true);
            seed.user("Anjali Shah", "admin" + SampleData.DOMAIN, Role.ADMIN, UserStatus.ACTIVE, base, true);
        }
        log.info("Test seed done: 3 Admins, {} Employees, {} demo accounts", EMPLOYEE_POOL, demoMode ? 2 : 0);
    }

    /** One batched INSERT instead of 4,000 entity saves, so the seed takes seconds. */
    private void insertEmployees(Office base, String hash) {
        Timestamp now = Timestamp.from(Instant.now().truncatedTo(ChronoUnit.MICROS));
        List<Object[]> rows = new ArrayList<>(EMPLOYEE_POOL);
        for (int i = 1; i <= EMPLOYEE_POOL; i++) {
            String number = String.format("%04d", i);
            rows.add(new Object[] { "Test Employee " + number, "emp-" + number + DOMAIN, hash, base.getId(), now, now });
        }
        jdbc.batchUpdate("INSERT INTO users (name, email, password_hash, role, status, office_id, is_demo, created_at, updated_at) "
                + "VALUES (?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, FALSE, ?, ?)", rows);
    }
}
