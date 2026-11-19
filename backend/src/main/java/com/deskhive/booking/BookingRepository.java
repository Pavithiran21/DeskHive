package com.deskhive.booking;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.LockModeType;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByIdAndUserId(Long id, Long userId);

    /** The space id of one of the user's bookings (0 if its space was deleted), as a scalar: loads no entity. */
    @Query("select coalesce(b.spaceId, 0L) from Booking b where b.id = :id and b.userId = :userId")
    Optional<Long> findOwnedSpaceId(Long id, Long userId);

    /** SELECT ... FOR UPDATE on one booking: change, cancel and check-in take it before reading the status. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> lockById(Long id);

    /**
     * How many active bookings of the space overlap [start, end). Two time ranges overlap when each
     * starts before the other ends. Back-to-back bookings (one ends at 10:00, the next starts at
     * 10:00) do not overlap. excludeId lets a change ignore the booking being changed (use -1 for none).
     */
    @Query("""
            select count(b) from Booking b
            where b.spaceId = :spaceId
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.startAt < :end and b.endAt > :start
              and b.id <> :excludeId
            """)
    long countOverlapping(Long spaceId, Instant start, Instant end, Long excludeId);

    /** The user's active desk bookings on a day (the one-desk-a-day rule), ignoring the booking being changed. */
    @Query("""
            select count(b) from Booking b
            where b.userId = :userId and b.bookingDate = :date
              and b.spaceType = com.deskhive.office.SpaceType.DESK
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.id <> :excludeId
            """)
    long countDeskBookingsOnDate(Long userId, LocalDate date, Long excludeId);

    /** The user's desk booking on a day, to name it in the "one desk a day" message. */
    @Query("""
            select b from Booking b
            where b.userId = :userId and b.bookingDate = :date
              and b.spaceType = com.deskhive.office.SpaceType.DESK
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.id <> :excludeId
            order by b.startAt
            """)
    List<Booking> findDeskBookingsOnDate(Long userId, LocalDate date, Long excludeId, Limit limit);

    /** Ids of the given spaces that have an active booking overlapping [start, end). */
    @Query("""
            select distinct b.spaceId from Booking b
            where b.spaceId in :spaceIds
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.startAt < :end and b.endAt > :start
            """)
    List<Long> findBookedSpaceIds(Collection<Long> spaceIds, Instant start, Instant end);

    /** Active bookings of the given spaces that overlap [start, end), earliest first (room day bars). */
    @Query("""
            select b from Booking b
            where b.spaceId in :spaceIds
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.startAt < :end and b.endAt > :start
            order by b.startAt
            """)
    List<Booking> findActiveOverlapping(Collection<Long> spaceIds, Instant start, Instant end);

    /** My bookings, Upcoming tab: still active and not ended yet, soonest first. */
    @Query("""
            select b from Booking b
            where b.userId = :userId
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.endAt > :now
            order by b.startAt asc, b.id asc
            """)
    Page<Booking> findUpcoming(Long userId, Instant now, Pageable pageable);

    /** My bookings, Past tab: ended, cancelled or released, most recent first. */
    @Query("""
            select b from Booking b
            where b.userId = :userId
              and not (b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
                       and b.endAt > :now)
            order by b.startAt desc, b.id desc
            """)
    Page<Booking> findPast(Long userId, Instant now, Pageable pageable);

    /** All bookings for the admin list, newest first, with optional filters. q matches the person or the space. */
    @Query("""
            select b from Booking b, User u
            where b.userId = u.id
              and (:officeId is null or b.officeId = :officeId)
              and (:from is null or b.bookingDate >= :from)
              and (:to is null or b.bookingDate <= :to)
              and (:status is null or b.status = :status)
              and (:q is null or lower(u.name) like :q or lower(u.email) like :q or lower(b.spaceLabel) like :q)
            order by b.startAt desc, b.id desc
            """)
    Page<Booking> search(Long officeId, LocalDate from, LocalDate to, BookingStatus status, String q, Pageable pageable);

    /** Active bookings that have not ended, for deleting a space or a person (the message gives the count). */
    @Query("""
            select count(b) from Booking b
            where b.spaceId = :spaceId
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.endAt > :now
            """)
    long countUpcomingForSpace(Long spaceId, Instant now);

    /** Cancels everything a person still has coming up (access removed, account deleted). */
    @Modifying
    @Transactional
    @Query("""
            update Booking b set b.status = com.deskhive.booking.BookingStatus.CANCELLED,
                   b.cancelledBy = :byUserId, b.cancelReason = :reason, b.updatedAt = :now
            where b.userId = :userId
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
              and b.endAt > :now
            """)
    int cancelUpcomingForUser(Long userId, Long byUserId, String reason, Instant now);

    /** People table: how many active bookings each person has in a date range. */
    @Query("""
            select b.userId, count(b) from Booking b
            where b.userId in :userIds and b.bookingDate between :from and :to
              and b.status in (com.deskhive.booking.BookingStatus.CONFIRMED, com.deskhive.booking.BookingStatus.CHECKED_IN)
            group by b.userId
            """)
    List<Object[]> countActiveByUser(Collection<Long> userIds, LocalDate from, LocalDate to);

    /** Every booking of an office in a date range, any status, for the occupancy report (optionally one floor). */
    @Query("""
            select b from Booking b
            where b.officeId = :officeId and b.bookingDate between :from and :to
              and (:floorId is null or b.spaceId in (select s.id from Space s where s.floorId = :floorId))
            """)
    List<Booking> findForReport(Long officeId, Long floorId, LocalDate from, LocalDate to);

    // ---- Jobs: each claim is one UPDATE whose row count says whether this run won ----

    /** Confirmed bookings whose check-in grace period is over (start + 15 min is before now), oldest first. */
    @Query("""
            select b from Booking b
            where b.status = com.deskhive.booking.BookingStatus.CONFIRMED and b.startAt < :cutoff and b.id > :afterId
            order by b.id
            """)
    List<Booking> findDueForRelease(Instant cutoff, Long afterId, Limit limit);

    /** Releases the booking only if it is still CONFIRMED. Returns 1 for the one run that did it. */
    @Modifying
    @Transactional
    @Query("""
            update Booking b set b.status = com.deskhive.booking.BookingStatus.AUTO_RELEASED, b.updatedAt = :now
            where b.id = :id and b.status = com.deskhive.booking.BookingStatus.CONFIRMED
            """)
    int claimRelease(Long id, Instant now);

    /**
     * Confirmed bookings starting within the next hour that have no reminder yet, and that were made
     * or last changed at least an hour before the start (a later booking gets no reminder).
     */
    @Query("""
            select b from Booking b
            where b.status = com.deskhive.booking.BookingStatus.CONFIRMED and b.reminderSentAt is null
              and b.startAt > :now and b.startAt <= :horizon and b.id > :afterId
            order by b.id
            """)
    List<Booking> findDueForReminder(Instant now, Instant horizon, Long afterId, Limit limit);

    /** Marks the reminder as sent only if nobody did yet. Returns 1 for the one run that did it. */
    @Modifying
    @Transactional
    @Query("""
            update Booking b set b.reminderSentAt = :now
            where b.id = :id and b.reminderSentAt is null and b.status = com.deskhive.booking.BookingStatus.CONFIRMED
            """)
    int claimReminder(Long id, Instant now);
}
