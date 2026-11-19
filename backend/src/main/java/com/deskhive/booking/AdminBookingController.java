package com.deskhive.booking;

import java.time.LocalDate;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;

import com.deskhive.booking.BookingDtos.BookingResponse;
import com.deskhive.booking.BookingDtos.CancelRequest;
import com.deskhive.common.web.PageQuery;
import com.deskhive.common.web.PageResponse;
import com.deskhive.user.CurrentUser;

import jakarta.validation.Valid;

/** Admin: every booking of every person. Each method checks the Admin role in the service layer. */
@RestController
@RequestMapping("/api/admin/bookings")
public class AdminBookingController {

    private final BookingService bookingService;

    public AdminBookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping
    public PageResponse<BookingResponse> search(CurrentUser actor,
            @RequestParam(required = false) Long officeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return bookingService.searchAsAdmin(actor, officeId, from, to, status, q, PageQuery.unsorted(page, size));
    }

    @GetMapping("/{id}")
    public BookingResponse get(CurrentUser actor, @PathVariable Long id) {
        return bookingService.getAsAdmin(actor, id);
    }

    /** The reason is required: the employee reads it in the email. */
    @PostMapping("/{id}/cancel")
    public BookingResponse cancel(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody CancelRequest body) {
        return bookingService.cancelAsAdmin(actor, id, body.reason());
    }
}
