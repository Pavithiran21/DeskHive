package com.deskhive.job;

import java.time.Clock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Runs the two jobs on RELEASE_CRON (every minute by default) and REMINDER_CRON (every 5 minutes).
 * "-" turns a job off, which the test environment does so only the tests decide when a job runs.
 * Spring never starts a method again while its previous run is still going; an overlapping run from
 * the job endpoint is safe anyway (see ReleaseService and ReminderService).
 */
@Component
public class ScheduledJobs {

    private static final Logger log = LoggerFactory.getLogger(ScheduledJobs.class);

    private final ReleaseService releaseService;
    private final ReminderService reminderService;
    private final Clock clock;

    public ScheduledJobs(ReleaseService releaseService, ReminderService reminderService, Clock clock) {
        this.releaseService = releaseService;
        this.reminderService = reminderService;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.release-cron}", zone = "UTC")
    public void release() {
        try {
            releaseService.run(clock.instant(), "SCHEDULE");
        } catch (RuntimeException ex) {
            log.error("Release job failed", ex);
        }
    }

    @Scheduled(cron = "${app.reminder-cron}", zone = "UTC")
    public void remind() {
        try {
            reminderService.run(clock.instant(), "SCHEDULE");
        } catch (RuntimeException ex) {
            log.error("Reminder job failed", ex);
        }
    }
}
