package com.deskhive.seed;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Demo data for one demo (scripts\demo-up.ps1): the Northwind sample office ({@link SampleData}) plus one
 * booking for the demo Employee that starts now, so "I'm here, check in" works during the demo. The
 * booking skips the rules on purpose (a demo can run after opening hours); if nobody checks in, the
 * release job releases it 15 minutes after its start, as it would for a real booking.
 *
 * Refuses any database except "deskhive_demo", which demo-down drops again afterwards.
 */
@Component
@Profile("seed-demo")
public class SeedDemoRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDemoRunner.class);
    private static final String DEMO_DATABASE = "deskhive_demo";

    private final SeedSupport seed;
    private final SampleData sampleData;
    private final Clock clock;

    public SeedDemoRunner(SeedSupport seed, SampleData sampleData, Clock clock) {
        this.seed = seed;
        this.sampleData = sampleData;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed.runAndExit("Demo seed", this::seed, log);
    }

    private void seed() {
        seed.requireDatabase("seed-demo", DEMO_DATABASE);
        seed.requireDemoPassword();
        seed.wipeAll();
        SampleData.Built built = sampleData.build();

        // Started at the last 5-minute mark: check-in stays open for at least 10 more minutes.
        Instant now = clock.instant().truncatedTo(ChronoUnit.MINUTES);
        Instant start = now.minus(Duration.ofMinutes(now.atZone(built.bengaluru().zone()).getMinute() % 5));
        seed.bookAt(built.priya(), seed.desk(built.floor4(), "D", 5), built.floor4(), built.bengaluru(), start,
                start.plus(Duration.ofHours(3)));
        log.info("Demo seed done: the sample office plus a booking that starts now for the demo Employee");
    }
}
