package com.deskhive.job;

import java.time.Clock;
import java.time.Duration;
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
import com.deskhive.mail.MailEvents.ReminderDue;

/**
 * The reminder email about one hour before a booking starts. A run looks at confirmed bookings that
 * start within the next 60 minutes and have no reminder yet. Because the job runs every few minutes, the
 * email goes out between 60 and about 55 minutes before the start.
 *
 * A booking made (or last changed) less than an hour before its start gets no reminder: the
 * confirmation email just went out, and "starts in 1 hour" would be wrong.
 *
 * At most one email per booking, even with overlapping runs: the claim is one UPDATE ... SET
 * reminder_sent_at WHERE reminder_sent_at IS NULL, and only the run that gets "1 row changed" asks for
 * the email. A failed send is not retried (the SMTP server may have accepted it). A change of date, time
 * or desk clears reminder_sent_at, so the new time gets its own reminder.
 *
 * Not @Transactional on purpose: each claim commits by itself. The email is then sent in the background
 * (MailEvents.ReminderDue, MailEventListener), so a slow SMTP server never holds up the run.
 */
@Service
public class ReminderService {

    public static final Duration LEAD_TIME = Duration.ofHours(1);
    private static final int PAGE_SIZE = 200;
    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);

    private final BookingRepository bookings;
    private final JobRunRepository jobRuns;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ReminderService(BookingRepository bookings, JobRunRepository jobRuns, ApplicationEventPublisher events,
            Clock clock) {
        this.bookings = bookings;
        this.jobRuns = jobRuns;
        this.events = events;
        this.clock = clock;
    }

    public JobRunSummary run(Instant now, String trigger) {
        String runId = UUID.randomUUID().toString();
        JobRun jobRun = jobRuns.save(JobRun.start(runId, "REMINDER", trigger, now, clock.instant()));
        JobCounters counters = new JobCounters();
        String finalStatus = "FAILED";
        try {
            Instant horizon = now.plus(LEAD_TIME);
            long afterId = 0;
            List<Booking> page = bookings.findDueForReminder(now, horizon, afterId, Limit.of(PAGE_SIZE));
            while (!page.isEmpty()) {
                for (Booking booking : page) {
                    remind(booking, now, counters);
                }
                afterId = page.get(page.size() - 1).getId();
                page = bookings.findDueForReminder(now, horizon, afterId, Limit.of(PAGE_SIZE));
            }
            finalStatus = "FINISHED";
        } finally {
            JobRunSummary summary = counters.toSummary(runId, "REMINDER", now);
            jobRun.finish(finalStatus, summary, clock.instant());
            jobRuns.save(jobRun);
            if (summary.bookingsDone() > 0 || "FAILED".equals(finalStatus)) {
                log.info("Reminder job {} {} (as of {}): due={}, reminded={}, skipped={}", runId,
                        finalStatus.toLowerCase(), now, summary.bookingsSeen(), summary.bookingsDone(), summary.skipped());
            }
        }
        return counters.toSummary(runId, "REMINDER", now);
    }

    private void remind(Booking booking, Instant now, JobCounters counters) {
        counters.seen++;
        boolean madeTooLate = booking.getUpdatedAt().isAfter(booking.getStartAt().minus(LEAD_TIME));
        if (madeTooLate || bookings.claimReminder(booking.getId(), now) != 1) {
            counters.skipped++;
            return;
        }
        counters.done++;
        events.publishEvent(new ReminderDue(booking.getId()));
    }
}
