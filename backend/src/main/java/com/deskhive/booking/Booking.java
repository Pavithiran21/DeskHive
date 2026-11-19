package com.deskhive.booking;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.deskhive.office.SpaceType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * One reservation of one desk or room. Instants are UTC; bookingDate is the day in the office's time
 * zone. spaceLabel, floorName, officeName and timeZone are snapshots, so the booking still reads
 * correctly after its space is deleted (spaceId is then null).
 */
@Entity
@Table(name = "bookings")
public class Booking {

    /** Check-in opens this long before the start and closes this long after it (then auto-release). */
    public static final Duration CHECK_IN_WINDOW = Duration.ofMinutes(15);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "space_id")
    private Long spaceId;

    @Column(name = "space_label", nullable = false, length = 100)
    private String spaceLabel;

    @Column(name = "floor_name", nullable = false, length = 60)
    private String floorName;

    @Column(name = "office_name", nullable = false, length = 80)
    private String officeName;

    @Enumerated(EnumType.STRING)
    @Column(name = "space_type", nullable = false, length = 4)
    private SpaceType spaceType;

    @Column(name = "office_id")
    private Long officeId;

    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BookingStatus status = BookingStatus.CONFIRMED;

    @Column(name = "checked_in_at")
    private Instant checkedInAt;

    @Column(name = "cancelled_by")
    private Long cancelledBy;

    @Column(name = "cancel_reason", length = 200)
    private String cancelReason;

    @Column(name = "reminder_sent_at")
    private Instant reminderSentAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Booking() {
    }

    public Booking(Long userId, Long spaceId, SpaceType spaceType, String spaceLabel, String floorName,
            Long officeId, String officeName, String timeZone, Instant startAt, Instant endAt, LocalDate bookingDate) {
        this.userId = userId;
        this.spaceId = spaceId;
        this.spaceType = spaceType;
        this.spaceLabel = spaceLabel;
        this.floorName = floorName;
        this.officeId = officeId;
        this.officeName = officeName;
        this.timeZone = timeZone;
        this.startAt = startAt;
        this.endAt = endAt;
        this.bookingDate = bookingDate;
    }

    @PrePersist
    void onCreate() {
        // MySQL keeps microseconds; truncating here makes the response match what is stored.
        createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    public boolean hasEnded(Instant now) {
        return !endAt.isAfter(now);
    }

    public boolean hasStarted(Instant now) {
        return !startAt.isAfter(now);
    }

    public Instant checkInOpensAt() {
        return startAt.minus(CHECK_IN_WINDOW);
    }

    public Instant checkInClosesAt() {
        return startAt.plus(CHECK_IN_WINDOW);
    }

    /** Moves the booking to another desk (or time) after the checks passed. A new time means a new reminder. */
    public void reschedule(Long newSpaceId, String newLabel, String newFloorName, Instant newStart, Instant newEnd,
            LocalDate newDate) {
        this.spaceId = newSpaceId;
        this.spaceLabel = newLabel;
        this.floorName = newFloorName;
        this.startAt = newStart;
        this.endAt = newEnd;
        this.bookingDate = newDate;
        this.reminderSentAt = null;
    }

    public void cancel(Long byUserId, String reason) {
        this.status = BookingStatus.CANCELLED;
        this.cancelledBy = byUserId;
        this.cancelReason = reason;
    }

    /** Used by the seed scripts to create a released booking (the release job uses a conditional UPDATE instead). */
    public void markAutoReleased() {
        this.status = BookingStatus.AUTO_RELEASED;
    }

    public void checkIn(Instant now) {
        this.status = BookingStatus.CHECKED_IN;
        this.checkedInAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public String getSpaceLabel() {
        return spaceLabel;
    }

    public String getFloorName() {
        return floorName;
    }

    public String getOfficeName() {
        return officeName;
    }

    public SpaceType getSpaceType() {
        return spaceType;
    }

    public Long getOfficeId() {
        return officeId;
    }

    public String getTimeZone() {
        return timeZone;
    }

    public Long getUserId() {
        return userId;
    }

    public Instant getStartAt() {
        return startAt;
    }

    public Instant getEndAt() {
        return endAt;
    }

    public LocalDate getBookingDate() {
        return bookingDate;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public Instant getCheckedInAt() {
        return checkedInAt;
    }

    public Long getCancelledBy() {
        return cancelledBy;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
