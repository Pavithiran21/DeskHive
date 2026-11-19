package com.deskhive.office;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** A location. Its time zone decides what "today", the opening hours and every shown time mean. */
@Entity
@Table(name = "offices")
public class Office {

    public static final LocalTime DEFAULT_OPENS = LocalTime.of(8, 0);
    public static final LocalTime DEFAULT_CLOSES = LocalTime.of(19, 0);
    public static final int DEFAULT_BOOK_AHEAD_DAYS = 14;
    public static final int DEFAULT_MAX_BOOKING_MINUTES = 8 * 60;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 200)
    private String address;

    /** IANA zone such as "Asia/Kolkata". Never changed after the office is created. */
    @Column(name = "time_zone", nullable = false, length = 64, updatable = false)
    private String timeZone;

    @Column(name = "opens_at", nullable = false)
    private LocalTime opensAt = DEFAULT_OPENS;

    @Column(name = "closes_at", nullable = false)
    private LocalTime closesAt = DEFAULT_CLOSES;

    @Column(name = "book_ahead_days", nullable = false)
    private int bookAheadDays = DEFAULT_BOOK_AHEAD_DAYS;

    @Column(name = "max_booking_minutes", nullable = false)
    private int maxBookingMinutes = DEFAULT_MAX_BOOKING_MINUTES;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Office() {
    }

    public Office(String name, String address, String timeZone) {
        this.name = name;
        this.address = address;
        this.timeZone = timeZone;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    public ZoneId zone() {
        return ZoneId.of(timeZone);
    }

    public Duration maxBooking() {
        return Duration.ofMinutes(maxBookingMinutes);
    }

    public Duration openLength() {
        return Duration.between(opensAt, closesAt);
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getTimeZone() {
        return timeZone;
    }

    public LocalTime getOpensAt() {
        return opensAt;
    }

    public void setOpensAt(LocalTime opensAt) {
        this.opensAt = opensAt;
    }

    public LocalTime getClosesAt() {
        return closesAt;
    }

    public void setClosesAt(LocalTime closesAt) {
        this.closesAt = closesAt;
    }

    public int getBookAheadDays() {
        return bookAheadDays;
    }

    public void setBookAheadDays(int bookAheadDays) {
        this.bookAheadDays = bookAheadDays;
    }

    public int getMaxBookingMinutes() {
        return maxBookingMinutes;
    }

    public void setMaxBookingMinutes(int maxBookingMinutes) {
        this.maxBookingMinutes = maxBookingMinutes;
    }
}
