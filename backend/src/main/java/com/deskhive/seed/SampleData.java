package com.deskhive.seed;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import com.deskhive.auth.TokenHashing;
import com.deskhive.booking.Booking;
import com.deskhive.invitation.Invitation;
import com.deskhive.invitation.InvitationRepository;
import com.deskhive.invitation.InvitationService;
import com.deskhive.office.Feature;
import com.deskhive.office.Floor;
import com.deskhive.office.Office;
import com.deskhive.office.Space;
import com.deskhive.user.Role;
import com.deskhive.user.User;
import com.deskhive.user.UserStatus;

/**
 * The Northwind sample office that the dev seed and the demo seed both build (password DEMO_PASSWORD for
 * everyone): two offices in two time zones, floors with desks (area, row, number, features) and rooms, two
 * Admins, four Employees, a pending and an expired invitation, a removed person and bookings in every status,
 * so each screen has something to show. Every address ends with @demo.deskhive.test, so any email the app
 * sends goes to the demo Ethereal inbox (DEMO_SMTP_*), never through Brevo.
 */
@Component
@Profile({ "seed-dev", "seed-demo" })
public class SampleData {

    public static final String DOMAIN = "@demo.deskhive.test";

    private final SeedSupport seed;
    private final InvitationRepository invitations;
    private final Clock clock;

    public SampleData(SeedSupport seed, InvitationRepository invitations, Clock clock) {
        this.seed = seed;
        this.invitations = invitations;
        this.clock = clock;
    }

    /** What a runner may build on after the sample data exists. */
    public record Built(Office bengaluru, Floor floor4, User priya) {
    }

    /** Builds the sample data in an empty database (the caller checks the database name and wipes it first). */
    public Built build() {
        // Offices, floors, desks and rooms
        Office bengaluru = seed.office("Northwind Bengaluru", "12 Residency Road, Bengaluru 560025", "Asia/Kolkata");
        Floor floor4 = seed.floor(bengaluru, "Floor 4");
        Floor floor5 = seed.floor(bengaluru, "Floor 5");
        seed.desks(floor4, "Quiet zone", "A", 1, 6, Feature.WINDOW);
        seed.desks(floor4, "Quiet zone", "B", 1, 6);
        seed.desks(floor4, "Dual monitor desks", "C", 1, 6, Feature.DUAL_MONITOR);
        seed.desks(floor4, "Standing desks", "D", 1, 4, Feature.STANDING);
        seed.desks(floor4, "Standing desks", "D", 5, 5, Feature.STANDING, Feature.ACCESSIBLE);
        seed.desks(floor5, "Open area", "A", 1, 6);
        Space hive = seed.room(floor4, "Hive room", 6, Feature.SCREEN, Feature.VIDEO_CALLS);
        seed.room(floor4, "Focus room", 2);
        seed.room(floor4, "Board room", 12, Feature.SCREEN, Feature.VIDEO_CALLS, Feature.WHITEBOARD, Feature.STEP_FREE);

        Office london = seed.office("Northwind London", "1 Canal Street, London E2 7AA", "Europe/London");
        Floor london1 = seed.floor(london, "Floor 1");
        seed.desks(london1, "Open area", "A", 1, 4);
        seed.room(london1, "Thames room", 4, Feature.SCREEN);

        // People
        User anjali = seed.user("Anjali Shah", "admin" + DOMAIN, Role.ADMIN, UserStatus.ACTIVE, bengaluru, true);
        seed.user("Karan Mehta", "karan" + DOMAIN, Role.ADMIN, UserStatus.ACTIVE, bengaluru, false);
        User priya = seed.user("Priya Raman", "employee" + DOMAIN, Role.EMPLOYEE, UserStatus.ACTIVE, bengaluru, true);
        User rahul = seed.user("Rahul Verma", "rahul" + DOMAIN, Role.EMPLOYEE, UserStatus.ACTIVE, bengaluru, false);
        User meera = seed.user("Meera Iyer", "meera" + DOMAIN, Role.EMPLOYEE, UserStatus.ACTIVE, bengaluru, false);
        seed.user("Tom Becker", "tom" + DOMAIN, Role.EMPLOYEE, UserStatus.ACTIVE, london, false);
        User former = seed.user("Vikram Rao", "vikram" + DOMAIN, Role.EMPLOYEE, UserStatus.REMOVED, bengaluru, false);

        // A pending invitation (link works, token not kept) and an expired one
        User pending = seed.user("newhire", "newhire" + DOMAIN, Role.EMPLOYEE, UserStatus.INVITED, bengaluru, false);
        var now = clock.instant();
        invitations.save(new Invitation(pending.getId(), anjali.getId(), TokenHashing.sha256Hex(TokenHashing.newOpaqueToken()),
                now, now.plus(InvitationService.LINK_LIFETIME)));
        User expired = seed.user("latecomer", "latecomer" + DOMAIN, Role.EMPLOYEE, UserStatus.INVITED, bengaluru, false);
        invitations.save(new Invitation(expired.getId(), anjali.getId(), TokenHashing.sha256Hex(TokenHashing.newOpaqueToken()),
                now.minus(Duration.ofDays(9)), now.minus(Duration.ofDays(2))));

        // Bookings in every status (dates relative to today in Bengaluru)
        LocalDate today = seed.today(bengaluru);
        LocalTime nine = LocalTime.of(9, 0);
        LocalTime one = LocalTime.of(13, 0);
        LocalTime five = LocalTime.of(17, 0);

        seed.book(priya, seed.desk(floor4, "B", 3), floor4, bengaluru, today.plusDays(1), nine, one);
        seed.book(priya, hive, floor4, bengaluru, today.plusDays(2), LocalTime.of(14, 0), LocalTime.of(15, 30));
        seed.book(rahul, seed.desk(floor4, "C", 2), floor4, bengaluru, today.plusDays(1), nine, five);
        seed.book(meera, seed.desk(floor4, "C", 3), floor4, bengaluru, today.plusDays(1), nine, five);
        seed.book(rahul, seed.desk(floor4, "A", 1), floor4, bengaluru, today.plusDays(3), nine, five);

        Booking checkedIn = seed.book(priya, seed.desk(floor4, "A", 2), floor4, bengaluru, today.minusDays(1), nine, five);
        checkedIn.checkIn(checkedIn.getStartAt());
        seed.save(checkedIn);

        Booking released = seed.book(priya, seed.desk(floor4, "B", 1), floor4, bengaluru, today.minusDays(3), nine, five);
        released.markAutoReleased();
        seed.save(released);

        Booking cancelledByAdmin = seed.book(priya, hive, floor4, bengaluru, today.minusDays(2), LocalTime.of(10, 0), LocalTime.of(11, 0));
        cancelledByAdmin.cancel(anjali.getId(), "The room is needed for a client visit.");
        seed.save(cancelledByAdmin);

        Booking byFormer = seed.book(former, seed.desk(floor4, "D", 1), floor4, bengaluru, today.minusDays(5), nine, five);
        byFormer.checkIn(byFormer.getStartAt());
        seed.save(byFormer);
        for (int day = 1; day <= 4; day++) {
            Booking earlier = seed.book(rahul, seed.desk(floor4, "A", 3), floor4, bengaluru, today.minusDays(day + 5), nine, five);
            earlier.checkIn(earlier.getStartAt());
            seed.save(earlier);
        }
        return new Built(bengaluru, floor4, priya);
    }
}
