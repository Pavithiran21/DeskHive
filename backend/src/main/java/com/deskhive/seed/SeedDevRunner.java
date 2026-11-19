package com.deskhive.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Development data: the Northwind sample office ({@link SampleData}). Run with scripts\seed.ps1 -Seed dev.
 * It EMPTIES all tables first and refuses to run on any database other than "deskhive".
 */
@Component
@Profile("seed-dev")
public class SeedDevRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedDevRunner.class);
    private static final String DEV_DATABASE = "deskhive";

    private final SeedSupport seed;
    private final SampleData sampleData;

    public SeedDevRunner(SeedSupport seed, SampleData sampleData) {
        this.seed = seed;
        this.sampleData = sampleData;
    }

    @Override
    public void run(ApplicationArguments args) {
        seed.runAndExit("Dev seed", this::seed, log);
    }

    private void seed() {
        seed.requireDatabase("seed-dev", DEV_DATABASE);
        seed.requireDemoPassword();
        seed.wipeAll();
        sampleData.build();
        log.info("Dev seed done: 2 offices, 3 floors, 33 desks, 4 rooms, 2 Admins, 4 Employees, 2 invitations, 1 removed person, "
                + "13 bookings (password = DEMO_PASSWORD)");
    }
}
