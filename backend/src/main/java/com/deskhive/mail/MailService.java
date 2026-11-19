package com.deskhive.mail;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import com.deskhive.auth.PasswordResetService;
import com.deskhive.booking.Booking;
import com.deskhive.booking.BookingRepository;
import com.deskhive.common.web.TimeText;
import com.deskhive.config.AppProperties;
import com.deskhive.invitation.Invitation;
import com.deskhive.invitation.InvitationRepository;
import com.deskhive.invitation.InvitationService;
import com.deskhive.office.Office;
import com.deskhive.office.OfficeRepository;
import com.deskhive.office.SpaceType;
import com.deskhive.user.User;
import com.deskhive.user.UserRepository;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;

/**
 * Sends DeskHive's six emails through plain SMTP (Ethereal in development and tests, Brevo for real mail;
 * only the SMTP_* values in .env differ). All of them use one Thymeleaf layout, which escapes every
 * value; a plain-text part is included for mail clients that don't show HTML. Every time is shown in the
 * office's time zone with the zone named.
 *
 * Demo addresses (@demo.deskhive.test) never exist, so their emails go to the demo Ethereal inbox
 * (DEMO_SMTP_*) and never through Brevo; without a demo inbox they are not sent.
 *
 * Sending never throws: it returns false and logs the email type, the user id and the error class only,
 * never the address, a name or an admin's reason.
 *
 * The booking confirmation (new or changed) carries a calendar file that adds or moves the event; the
 * admin-cancellation and auto-release emails carry one that removes it ({@link BookingCalendar}).
 */
@Service
public class MailService {

    /** Every demo account's address ends with this reserved domain. */
    public static final String DEMO_EMAIL_DOMAIN = "demo.deskhive.test";

    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private static final String LOGO_CID = "logo@deskhive";
    private static final ClassPathResource LOGO = new ClassPathResource("mail/logo.png");
    private static final String DEMO_ADDRESS_SUFFIX = "@" + DEMO_EMAIL_DOMAIN;

    /** One row of the booking card: "When" and its value. */
    public record Detail(String label, String value) {
    }

    private final JavaMailSender mailSender;
    private final DemoMailSender demoMailSender;
    private final ITemplateEngine templates;
    private final AppProperties props;
    private final UserRepository users;
    private final BookingRepository bookings;
    private final OfficeRepository offices;
    private final InvitationRepository invitations;

    public MailService(JavaMailSender mailSender, DemoMailSender demoMailSender, ITemplateEngine templates,
            AppProperties props, UserRepository users, BookingRepository bookings, OfficeRepository offices,
            InvitationRepository invitations) {
        this.mailSender = mailSender;
        this.demoMailSender = demoMailSender;
        this.templates = templates;
        this.props = props;
        this.users = users;
        this.bookings = bookings;
        this.offices = offices;
        this.invitations = invitations;
    }

    // ---- The six emails ----

    public boolean sendPasswordReset(User user, String token) {
        long minutes = PasswordResetService.LINK_LIFETIME.toMinutes();
        Message message = new Message("Reset your DeskHive password", "Reset your password",
                List.of("We got a request to reset the password for " + user.getEmail() + ".",
                        "The link works once and expires in " + minutes + " minutes."),
                List.of(), "Choose a new password", props.frontendUrl() + "/reset-password?token=" + token,
                "If you didn't ask for this, ignore this email. Your password stays the same.");
        return send("password_reset", user.getId(), user.getEmail(), message);
    }

    public boolean sendInvitation(Long invitationId, String token) {
        Invitation invitation = invitations.findById(invitationId).orElse(null);
        User invited = invitation == null ? null : users.findById(invitation.getUserId()).orElse(null);
        if (invited == null) {
            return false;
        }
        User inviter = users.findById(invitation.getInvitedBy()).orElse(null);
        Office office = invited.getOfficeId() == null ? null : offices.findById(invited.getOfficeId()).orElse(null);
        String inviterName = inviter == null ? "Your admin" : inviter.displayName();
        long days = InvitationService.LINK_LIFETIME.toDays();

        List<Detail> details = new ArrayList<>();
        if (office != null) {
            details.add(new Detail("Office", office.getName()));
        }
        details.add(new Detail("Link works", "once, for " + days + " days"));
        Message message = new Message(inviterName + " invited you to DeskHive", "You're invited to " + props.companyName(),
                List.of(inviterName + " invited you to book desks and meeting rooms at " + props.companyName() + ".",
                        "Create your account to get started."),
                details, "Accept invitation", props.frontendUrl() + "/invite/" + token,
                "If you weren't expecting this, you can ignore this email.");
        return send("invitation", invited.getId(), invited.getEmail(), message);
    }

    /** The booking confirmation, or (changed = true) the same email after a change with another subject. */
    public boolean sendBookingConfirmation(Long bookingId, boolean changed) {
        return withBooking(bookingId, "booking_confirmation", BookingCalendar.Method.REQUEST, (booking, owner, zone) -> {
            String subject = (changed ? "Booking changed: " : "You're booked: ") + what(booking) + " on "
                    + TimeText.shortDate(booking.getBookingDate());
            String intro = changed ? "Your booking was changed. Here are the new details."
                    : "Your " + (booking.getSpaceType() == SpaceType.DESK ? "seat" : "room") + " is reserved.";
            return new Message(subject, changed ? "Booking changed" : "You're booked", List.of(intro),
                    bookingDetails(booking, zone, true), "View booking", bookingUrl(booking),
                    "You can change or cancel the booking from My bookings until it starts.");
        });
    }

    /** About one hour before the start. The button opens the booking: check-in opens 15 minutes before. */
    public boolean sendReminder(Long bookingId) {
        return withBooking(bookingId, "booking_reminder", (booking, owner, zone) -> {
            String window = TimeText.clock(booking.checkInOpensAt(), zone) + " and "
                    + TimeText.clock(booking.checkInClosesAt(), zone) + " " + TimeText.zoneName(zone, booking.getStartAt());
            return new Message("Starts in 1 hour: " + what(booking), "Your booking starts in 1 hour",
                    List.of("Check in from the booking between " + window + ", or it will be released."),
                    bookingDetails(booking, zone, false), "View booking", bookingUrl(booking),
                    "Can't make it? Cancel the booking so a colleague can use it.");
        });
    }

    public boolean sendAutoRelease(Long bookingId) {
        return withBooking(bookingId, "booking_released", BookingCalendar.Method.CANCEL, (booking, owner, zone) -> {
            boolean desk = booking.getSpaceType() == SpaceType.DESK;
            String subject = (desk ? "Seat " + booking.getSpaceLabel() : booking.getSpaceLabel()) + " was released";
            return new Message(subject, "Your booking was released",
                    List.of("You didn't check in within 15 minutes of the start, so the " + (desk ? "seat" : "room")
                            + " went back to your team."),
                    bookingDetails(booking, zone, false), desk ? "Book another seat" : "Book another room",
                    props.frontendUrl() + "/home", "Check in from My bookings between 15 minutes before and 15 minutes after the start.");
        });
    }

    /** Sent when an Admin cancels someone's booking; it names the admin and gives the reason they wrote. */
    public boolean sendCancelledByAdmin(Long bookingId) {
        return withBooking(bookingId, "booking_cancelled", BookingCalendar.Method.CANCEL, (booking, owner, zone) -> {
            User admin = booking.getCancelledBy() == null ? null : users.findById(booking.getCancelledBy()).orElse(null);
            String by = admin == null ? "An admin" : admin.displayName();
            boolean desk = booking.getSpaceType() == SpaceType.DESK;
            List<Detail> details = new ArrayList<>(bookingDetails(booking, zone, false));
            details.add(new Detail("Reason", booking.getCancelReason() == null ? "" : booking.getCancelReason()));
            return new Message("Your booking was cancelled", "Your booking was cancelled",
                    List.of(by + " cancelled your booking."), details, desk ? "Find another seat" : "Find another room",
                    props.frontendUrl() + "/home", "Questions? Ask " + by + " or your admin.");
        });
    }

    // ---- Building and sending ----

    /** What a template needs for one email; calendar is the optional .ics attachment. */
    private record Message(String subject, String headline, List<String> paragraphs, List<Detail> details,
            String buttonLabel, String buttonUrl, String footnote, BookingCalendar.Attachment calendar) {

        Message(String subject, String headline, List<String> paragraphs, List<Detail> details, String buttonLabel,
                String buttonUrl, String footnote) {
            this(subject, headline, paragraphs, details, buttonLabel, buttonUrl, footnote, null);
        }

        Message withCalendar(BookingCalendar.Attachment attachment) {
            return new Message(subject, headline, paragraphs, details, buttonLabel, buttonUrl, footnote, attachment);
        }
    }

    @FunctionalInterface
    private interface BookingMessage {
        Message build(Booking booking, User owner, ZoneId zone);
    }

    private boolean withBooking(Long bookingId, String type, BookingMessage builder) {
        return withBooking(bookingId, type, null, builder);
    }

    /** calendar: REQUEST adds or moves the event in the reader's calendar, CANCEL removes it, null attaches none. */
    private boolean withBooking(Long bookingId, String type, BookingCalendar.Method calendar, BookingMessage builder) {
        Booking booking = bookings.findById(bookingId).orElse(null);
        User owner = booking == null ? null : users.findById(booking.getUserId()).orElse(null);
        if (owner == null) {
            return false;
        }
        Message message = builder.build(booking, owner, ZoneId.of(booking.getTimeZone()));
        if (calendar != null) {
            message = message.withCalendar(BookingCalendar.forBooking(booking, calendar, props.companyName() + " DeskHive",
                    senderAddress(), owner.getEmail(), bookingUrl(booking), Instant.now()));
        }
        return send(type, owner.getId(), owner.getEmail(), message);
    }

    /** The plain address in MAIL_FROM ("DeskHive <no-reply@x>" -> "no-reply@x"), the calendar event's organiser. */
    private String senderAddress() {
        try {
            return new InternetAddress(props.mailFrom()).getAddress();
        } catch (AddressException ex) {
            return props.mailFrom();
        }
    }

    private boolean send(String type, Long userId, String to, Message message) {
        Context context = new Context();
        context.setVariable("headline", message.headline());
        context.setVariable("paragraphs", message.paragraphs());
        context.setVariable("details", message.details());
        context.setVariable("buttonLabel", message.buttonLabel());
        context.setVariable("buttonUrl", message.buttonUrl());
        context.setVariable("footnote", message.footnote());
        String html = templates.process("mail/message", context);
        String text = plainText(message);

        JavaMailSender sender = mailSender;
        if (isDemoAddress(to)) {
            if (!demoMailSender.isConfigured()) {
                log.warn("Email not sent: type={}, userId={}, error=DemoInboxNotConfigured (set DEMO_SMTP_*)", type, userId);
                return false;
            }
            sender = demoMailSender.sender();
        }
        try {
            MimeMessage mime = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(props.mailFrom());
            helper.setTo(to);
            helper.setSubject(message.subject());
            helper.setText(text, html);
            helper.addInline(LOGO_CID, LOGO, "image/png");
            if (message.calendar() != null) {
                BookingCalendar.Attachment calendar = message.calendar();
                helper.addAttachment(calendar.fileName(), new ByteArrayResource(calendar.content()), calendar.contentType());
            }
            sender.send(mime);
            return true;
        } catch (MailException | MessagingException ex) {
            // Class names only: an SMTP error message can quote the recipient's address. The cause
            // tells a timeout from a refused login or a TLS failure.
            log.warn("Email not sent: type={}, userId={}, error={}, cause={}", type, userId,
                    ex.getClass().getSimpleName(), rootCauseName(ex));
            return false;
        }
    }

    private static String plainText(Message message) {
        StringBuilder text = new StringBuilder(message.headline()).append("\n\n");
        message.paragraphs().forEach(paragraph -> text.append(paragraph).append("\n\n"));
        message.details().forEach(detail -> text.append(detail.label()).append(": ").append(detail.value()).append("\n"));
        if (!message.details().isEmpty()) {
            text.append("\n");
        }
        text.append(message.buttonLabel()).append(": ").append(message.buttonUrl()).append("\n\n").append(message.footnote()).append("\n");
        return text.toString();
    }

    // ---- Wording shared by the booking emails ----

    /** "seat B8" for a desk, the room's name for a room. */
    private static String what(Booking booking) {
        return booking.getSpaceType() == SpaceType.DESK ? "seat " + booking.getSpaceLabel() : booking.getSpaceLabel();
    }

    private static List<Detail> bookingDetails(Booking booking, ZoneId zone, boolean withCheckIn) {
        List<Detail> details = new ArrayList<>();
        String where = (booking.getSpaceType() == SpaceType.DESK ? "Seat " : "") + booking.getSpaceLabel() + " · "
                + booking.getFloorName() + " · " + booking.getOfficeName();
        details.add(new Detail("Where", where));
        details.add(new Detail("When", TimeText.shortDate(booking.getBookingDate()) + ", "
                + TimeText.range(booking.getStartAt(), booking.getEndAt(), zone)));
        if (withCheckIn) {
            Instant opens = booking.checkInOpensAt();
            details.add(new Detail("Check in", TimeText.clock(opens, zone) + " – " + TimeText.clock(booking.checkInClosesAt(), zone)
                    + " " + TimeText.zoneName(zone, opens)));
        }
        return details;
    }

    private String bookingUrl(Booking booking) {
        return props.frontendUrl() + "/bookings/" + booking.getId();
    }

    private static boolean isDemoAddress(String to) {
        return to.toLowerCase(Locale.ROOT).endsWith(DEMO_ADDRESS_SUFFIX);
    }

    /** The deepest cause's class. Spring's MailSendException keeps it per message, not as getCause(). */
    private static String rootCauseName(Exception ex) {
        Throwable cause = ex;
        if (ex instanceof MailSendException sendFailure && sendFailure.getMessageExceptions().length > 0) {
            cause = sendFailure.getMessageExceptions()[0];
        }
        return NestedExceptionUtils.getMostSpecificCause(cause).getClass().getSimpleName();
    }
}
