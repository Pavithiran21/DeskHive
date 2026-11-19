package com.deskhive.mail;

/**
 * Things that happened and should be told by email. Services publish them inside their transaction;
 * {@link MailEventListener} sends the email only after the transaction has committed, so a rolled-back
 * booking never sends a confirmation and no database lock is held while talking to the SMTP server.
 */
public final class MailEvents {

    private MailEvents() {
    }

    /** A new booking, or (changed = true) a booking whose date, time or desk was changed. */
    public record BookingConfirmed(Long bookingId, boolean changed) {
    }

    public record BookingCancelledByAdmin(Long bookingId) {
    }

    /** The raw token is only in memory here: the database keeps just its SHA-256. */
    public record InvitationCreated(Long invitationId, String token) {
    }

    /** Published by the reminder job after its claim on the booking has committed. */
    public record ReminderDue(Long bookingId) {
    }

    /** Published by the release job after its claim on the booking has committed. */
    public record BookingReleased(Long bookingId) {
    }
}
