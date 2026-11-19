package com.deskhive.job;

import java.time.Instant;

/**
 * What a job run returns and stores. bookingsSeen: bookings that were due. bookingsDone: those this run
 * handled (released, or reminded). skipped: due bookings another run handled first, or that need no email.
 * The emails are sent after the run, in the background (MailEventListener), so a failed send is logged by
 * MailService and not counted here.
 */
public record JobRunSummary(String runId, String job, Instant asOf, int bookingsSeen, int bookingsDone, int skipped) {
}
