package com.deskhive.mail;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.deskhive.mail.MailEvents.BookingCancelledByAdmin;
import com.deskhive.mail.MailEvents.BookingConfirmed;
import com.deskhive.mail.MailEvents.BookingReleased;
import com.deskhive.mail.MailEvents.InvitationCreated;
import com.deskhive.mail.MailEvents.ReminderDue;

/**
 * Sends the emails for events that services published inside a transaction. Two things matter here:
 * AFTER_COMMIT, so a booking that was rolled back (it lost a race) never sends a confirmation, and
 * {@code @Async}, so the SMTP server's speed doesn't slow the API response or hold a database lock.
 * The listeners re-read the booking from the database, so they send what was really saved.
 */
@Component
public class MailEventListener {

    private final MailService mailService;

    public MailEventListener(MailService mailService) {
        this.mailService = mailService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBookingConfirmed(BookingConfirmed event) {
        mailService.sendBookingConfirmation(event.bookingId(), event.changed());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCancelledByAdmin(BookingCancelledByAdmin event) {
        mailService.sendCancelledByAdmin(event.bookingId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInvitationCreated(InvitationCreated event) {
        mailService.sendInvitation(event.invitationId(), event.token());
    }

    // The two jobs are not transactional: each claim is its own committed UPDATE, and the job publishes
    // only after it won the claim. An AFTER_COMMIT listener would drop an event published outside a
    // transaction, so these are plain listeners. @Async keeps a slow SMTP server from holding the job
    // (Ethereal takes 5-16 s per email) or its HTTP trigger.

    @Async
    @EventListener
    public void onReminderDue(ReminderDue event) {
        mailService.sendReminder(event.bookingId());
    }

    @Async
    @EventListener
    public void onBookingReleased(BookingReleased event) {
        mailService.sendAutoRelease(event.bookingId());
    }
}
