package com.deskhive.mail;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

import com.deskhive.booking.Booking;
import com.deskhive.office.SpaceType;

/**
 * The calendar file (RFC 5545 iCalendar) attached to booking emails, so a booking lands in Google
 * Calendar, Outlook or Apple Calendar with one click and later emails update or remove the same event.
 *
 * <ul>
 * <li>One event per booking: {@code UID booking-<id>@deskhive}. A changed booking sends the same UID
 * with a higher {@code SEQUENCE}, so calendars move the event instead of adding a second one.</li>
 * <li>{@code SEQUENCE} is the whole seconds between the booking's creation and its last update: it
 * grows with every change and needs no extra column. A cancellation uses one more than that, so it
 * always comes after the last update.</li>
 * <li>Times are UTC ({@code ...Z}), so no time-zone block is needed; calendars show them in the
 * reader's zone, and the email itself names the office's zone.</li>
 * <li>Text is escaped (backslash, semicolon, comma, new line) and lines are folded at 75 octets.</li>
 * </ul>
 */
public final class BookingCalendar {

    /** What the attachment does: add or update the event, or remove it. */
    public enum Method {
        REQUEST, CANCEL
    }

    /** The file and the MIME type to attach it with. */
    public record Attachment(String fileName, String contentType, byte[] content) {
    }

    private static final DateTimeFormatter UTC = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private BookingCalendar() {
    }

    /**
     * @param organizerEmail the address the email is sent from (the event's organiser)
     * @param attendeeEmail the booking owner's address
     * @param url the booking's page in DeskHive
     * @param now the moment the file is made (DTSTAMP)
     */
    public static Attachment forBooking(Booking booking, Method method, String organizerName, String organizerEmail,
            String attendeeEmail, String url, Instant now) {
        boolean desk = booking.getSpaceType() == SpaceType.DESK;
        String summary = (desk ? "Seat " + booking.getSpaceLabel() : booking.getSpaceLabel()) + " · " + booking.getOfficeName();
        String location = (desk ? "Seat " : "") + booking.getSpaceLabel() + ", " + booking.getFloorName() + ", " + booking.getOfficeName();
        boolean cancel = method == Method.CANCEL;

        StringBuilder ics = new StringBuilder();
        line(ics, "BEGIN:VCALENDAR");
        line(ics, "VERSION:2.0");
        line(ics, "PRODID:-//DeskHive//Bookings//EN");
        line(ics, "CALSCALE:GREGORIAN");
        line(ics, "METHOD:" + method.name());
        line(ics, "BEGIN:VEVENT");
        line(ics, "UID:" + uid(booking));
        line(ics, "SEQUENCE:" + (sequence(booking) + (cancel ? 1 : 0)));
        line(ics, "DTSTAMP:" + UTC.format(now.truncatedTo(ChronoUnit.SECONDS)));
        line(ics, "DTSTART:" + UTC.format(booking.getStartAt()));
        line(ics, "DTEND:" + UTC.format(booking.getEndAt()));
        line(ics, "SUMMARY:" + text(summary));
        line(ics, "LOCATION:" + text(location));
        line(ics, "DESCRIPTION:" + text((cancel ? "Cancelled. " : "Check in from 15 minutes before the start, or the booking is released. ") + url));
        line(ics, "URL:" + url);
        line(ics, "ORGANIZER;CN=" + param(organizerName) + ":mailto:" + organizerEmail);
        line(ics, "ATTENDEE;CN=" + param(attendeeEmail) + ";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:" + attendeeEmail);
        line(ics, "STATUS:" + (cancel ? "CANCELLED" : "CONFIRMED"));
        line(ics, "TRANSP:OPAQUE");
        line(ics, "END:VEVENT");
        line(ics, "END:VCALENDAR");

        String contentType = "text/calendar; charset=UTF-8; method=" + method.name();
        return new Attachment(cancel ? "booking-cancelled.ics" : "booking.ics", contentType, ics.toString().getBytes(StandardCharsets.UTF_8));
    }

    static String uid(Booking booking) {
        return "booking-" + booking.getId() + "@deskhive";
    }

    static long sequence(Booking booking) {
        if (booking.getCreatedAt() == null || booking.getUpdatedAt() == null) {
            return 0;
        }
        return Math.max(0, Duration.between(booking.getCreatedAt(), booking.getUpdatedAt()).getSeconds());
    }

    /** TEXT value escaping (RFC 5545 3.3.11). */
    static String text(String value) {
        return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n");
    }

    /** A parameter value in quotes, without the characters a quoted parameter can't hold. */
    private static String param(String value) {
        return "\"" + value.replace("\"", "'").replace("\r", " ").replace("\n", " ") + "\"";
    }

    /** Appends one content line, folded so no physical line is longer than 75 octets, ended by CRLF. */
    private static void line(StringBuilder out, String content) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        int start = 0;
        int limit = 75;
        while (bytes.length - start > limit) {
            int end = start + limit;
            // Never cut a UTF-8 character in two: step back over continuation bytes (10xxxxxx).
            while ((bytes[end] & 0xC0) == 0x80) {
                end--;
            }
            out.append(new String(bytes, start, end - start, StandardCharsets.UTF_8)).append("\r\n ");
            start = end;
            limit = 74; // the leading space of a continuation line counts
        }
        out.append(new String(bytes, start, bytes.length - start, StandardCharsets.UTF_8)).append("\r\n");
    }
}
