package com.deskhive.seed;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Set;

import org.slf4j.Logger;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.deskhive.booking.Booking;
import com.deskhive.booking.BookingRepository;
import com.deskhive.config.AppProperties;
import com.deskhive.office.Feature;
import com.deskhive.office.Floor;
import com.deskhive.office.FloorRepository;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.Space;
import com.deskhive.office.SpaceRepository;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;
import com.deskhive.user.UserStatus;

/**
 * What the seed runners share: the database guard, wiping the tables, and small helpers that build
 * offices, floors, desks, rooms, people and bookings straight through the repositories. Seeded bookings
 * skip the booking rules on purpose (they include past ones) and send no email.
 */
@Component
@Profile({ "seed-admin", "seed-dev", "seed-test", "seed-demo" })
public class SeedSupport {

    private final JdbcTemplate jdbc;
    private final OfficeRepository offices;
    private final FloorRepository floors;
    private final SpaceRepository spaces;
    private final UserRepository users;
    private final BookingRepository bookings;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;
    private final ApplicationContext context;
    private final Clock clock;

    public SeedSupport(JdbcTemplate jdbc, OfficeRepository offices, FloorRepository floors, SpaceRepository spaces,
            UserRepository users, BookingRepository bookings, PasswordEncoder passwordEncoder, AppProperties props,
            ApplicationContext context, Clock clock) {
        this.jdbc = jdbc;
        this.offices = offices;
        this.floors = floors;
        this.spaces = spaces;
        this.users = users;
        this.bookings = bookings;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
        this.context = context;
        this.clock = clock;
    }

    /**
     * Runs a seed once and stops the app (and its scheduler threads) afterwards, with exit code 1 if the
     * seed failed, so the calling script can stop too.
     */
    public void runAndExit(String what, Runnable seed, Logger log) {
        int exitCode = 0;
        try {
            seed.run();
        } catch (RuntimeException ex) {
            log.error("{} failed: {}", what, ex.getMessage());
            exitCode = 1;
        }
        int finalExitCode = exitCode;
        System.exit(SpringApplication.exit(context, () -> finalExitCode));
    }

    /** Refuses to seed any database other than the expected ones, so a seed can't touch the wrong data. */
    public void requireDatabase(String profile, String... expected) {
        String database = jdbc.queryForObject("SELECT DATABASE()", String.class);
        if (!Set.of(expected).contains(database)) {
            throw new IllegalStateException(profile + " only runs on " + String.join(" or ", expected)
                    + ", not '" + database + "'");
        }
    }

    public void requireDemoPassword() {
        if (props.demoPassword() == null || props.demoPassword().length() < 8) {
            throw new IllegalStateException("Set DEMO_PASSWORD (at least 8 characters) in the env file");
        }
    }

    /** Empties every table, children first. Only called after requireDatabase. */
    public void wipeAll() {
        for (String table : new String[] { "bookings", "invitations", "refresh_tokens", "password_reset_tokens",
                "space_features", "spaces", "floors", "users", "offices", "job_runs" }) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    public Office office(String name, String address, String timeZone) {
        return offices.save(new Office(name, address, timeZone));
    }

    public Floor floor(Office office, String name) {
        return floors.save(new Floor(office.getId(), name));
    }

    /** Desks row+from .. row+to in an area, for example desks(floor, "Quiet zone", "A", 1, 6, WINDOW). */
    public void desks(Floor floor, String area, String row, int from, int to, Feature... features) {
        for (int number = from; number <= to; number++) {
            spaces.save(Space.desk(floor.getId(), area, row, number, Set.of(features)));
        }
    }

    public Space room(Floor floor, String name, int capacity, Feature... features) {
        return spaces.save(Space.room(floor.getId(), name, capacity, Set.of(features)));
    }

    public Space desk(Floor floor, String row, int number) {
        return spaces.findByFloorIdAndType(floor.getId(), com.deskhive.office.SpaceType.DESK).stream()
                .filter(space -> space.getRowLabel().equals(row) && space.getSeatNumber() == number)
                .findFirst().orElseThrow();
    }

    /** A person with the shared seed password (DEMO_PASSWORD). Invited and removed people have none or keep one. */
    public User user(String name, String email, Role role, UserStatus status, Office office, boolean demo) {
        String hash = status == UserStatus.INVITED ? null : passwordEncoder.encode(props.demoPassword());
        User user = new User(name, email, hash, role, status, office == null ? null : office.getId());
        user.setDemo(demo);
        return users.save(user);
    }

    /** An active person with a password hash computed once by the caller (the test seed's large pool). */
    public User userWithHash(String name, String email, String passwordHash, Role role, Office office, boolean demo) {
        User user = new User(name, email, passwordHash, role, UserStatus.ACTIVE, office == null ? null : office.getId());
        user.setDemo(demo);
        return users.save(user);
    }

    /** The calendar day it is in the office's time zone right now. */
    public LocalDate today(Office office) {
        return LocalDate.now(clock.withZone(office.zone()));
    }

    /** Saves a CONFIRMED booking (no rules, no email); change its status with the returned object and save(). */
    public Booking book(User user, Space space, Floor floor, Office office, LocalDate date, LocalTime from, LocalTime to) {
        ZoneId zone = office.zone();
        Instant start = ZonedDateTime.of(date, from, zone).toInstant();
        Instant end = ZonedDateTime.of(date, to, zone).toInstant();
        return bookings.save(new Booking(user.getId(), space.getId(), space.getType(), space.label(), floor.getName(),
                office.getId(), office.getName(), office.getTimeZone(), start, end, date));
    }

    /** Like {@link #book}, but from two instants (the demo's "starts now" booking, which may not be on a 30-minute step). */
    public Booking bookAt(User user, Space space, Floor floor, Office office, Instant start, Instant end) {
        LocalDate date = start.atZone(office.zone()).toLocalDate();
        return bookings.save(new Booking(user.getId(), space.getId(), space.getType(), space.label(), floor.getName(),
                office.getId(), office.getName(), office.getTimeZone(), start, end, date));
    }

    public Booking save(Booking booking) {
        return bookings.save(booking);
    }

    public String demoPassword() {
        return props.demoPassword();
    }

    public PasswordEncoder passwordEncoder() {
        return passwordEncoder;
    }

    public UserRepository users() {
        return users;
    }
}
