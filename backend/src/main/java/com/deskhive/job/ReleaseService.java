package com.deskhive.job;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import com.deskhive.booking.Booking;
import com.deskhive.booking.BookingRepository;
import com.deskhive.mail.MailEvents.BookingReleased;

/**
 * Auto-release: a booking that was not checked in within 15 minutes after its start is released, so the
 * space is free again, and the employee is emailed once.
 *
 * Why it is safe to run twice, or two runs at once (the schedule and the job endpoint): releasing is one
 * UPDATE ... WHERE id = ? AND status = 'CONFIRMED' and only the run that gets "1 row changed" asks for the
 * email. A check-in that happens at the same moment also changes status under a row lock, so a booking is
 * either checked in or released, never both.
 *
 * Not @Transactional on purpose: each claim commits by itself. The email is then sent in the background
 * (MailEvents.BookingReleased, MailEventListener), so a slow SMTP server never holds up the run.
 */
@Service
public class ReleaseService {

    private static final int PAGE_SIZE = 200;
    private static final Logger log = LoggerFactory.getLogger(ReleaseService.class);

    private final BookingRepository bookings;
    private final JobRunRepository jobRuns;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ReleaseService(BookingRepository bookings, JobRunRepository jobRuns, ApplicationEventPublisher events,
            Clock clock) {
        this.bookings = bookings;
        this.jobRuns = jobRuns;
        this.events = events;
        this.clock = clock;
    }

    public JobRunSummary run(Instant now, String trigger) {
        String runId = UUID.randomUUID().toString();
        JobRun jobRun = jobRuns.save(JobRun.start(runId, "RELEASE", trigger, now, clock.instant()));
        JobCounters counters = new JobCounters();
        String finalStatus = "FAILED";
        try {
            Instant cutoff = now.minus(Booking.CHECK_IN_WINDOW);
            long afterId = 0;
            List<Booking> page = bookings.findDueForRelease(cutoff, afterId, Limit.of(PAGE_SIZE));
            while (!page.isEmpty()) {
                for (Booking booking : page) {
                    release(booking, now, counters);
                }
                afterId = page.get(page.size() - 1).getId();
                page = bookings.findDueForRelease(cutoff, afterId, Limit.of(PAGE_SIZE));
            }
            finalStatus = "FINISHED";
        } finally {
            JobRunSummary summary = counters.toSummary(runId, "RELEASE", now);
            jobRun.finish(finalStatus, summary, clock.instant());
            jobRuns.save(jobRun);
            if (summary.bookingsSeen() > 0 || "FAILED".equals(finalStatus)) {
                log.info("Release job {} {} (as of {}): due={}, released={}, skipped={}", runId,
                        finalStatus.toLowerCase(), now, summary.bookingsSeen(), summary.bookingsDone(), summary.skipped());
            }
        }
        return counters.toSummary(runId, "RELEASE", now);
    }

    private void release(Booking booking, Instant now, JobCounters counters) {
        counters.seen++;
        if (bookings.claimRelease(booking.getId(), now) != 1) {
            counters.skipped++;   // checked in, cancelled or released by another run since we listed it
            return;
        }
        counters.done++;
        // A booking that has already ended (the job was off for a while) is released quietly: an email
        // saying "your seat was released" about yesterday would only confuse.
        if (!booking.hasEnded(now)) {
            events.publishEvent(new BookingReleased(booking.getId()));
        }
    }
}
