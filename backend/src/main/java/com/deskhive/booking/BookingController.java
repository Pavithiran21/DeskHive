package com.deskhive.booking;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.booking.BookingDtos.BookingResponse;
import com.deskhive.booking.BookingDtos.ChangeBookingRequest;
import com.deskhive.booking.BookingDtos.CreateBookingRequest;
import com.deskhive.common.error.ApiException;
import com.deskhive.common.web.PageQuery;
import com.deskhive.common.web.PageResponse;
import com.deskhive.user.CurrentUser;

import jakarta.validation.Valid;

/** The logged-in person's own bookings. Someone else's booking is a 404, never a 403. */
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponse create(CurrentUser actor, @Valid @RequestBody CreateBookingRequest body) {
        return bookingService.create(actor, body);
    }

    /** tab=upcoming (default) or tab=past. */
    @GetMapping
    public PageResponse<BookingResponse> list(CurrentUser actor,
            @RequestParam(defaultValue = "upcoming") String tab,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        if (!tab.equals("upcoming") && !tab.equals("past")) {
            throw ApiException.invalidField("tab", "Use one of: upcoming, past.");
        }
        return bookingService.listMine(actor, tab.equals("upcoming"), PageQuery.unsorted(page, size));
    }

    @GetMapping("/{id}")
    public BookingResponse get(CurrentUser actor, @PathVariable Long id) {
        return bookingService.get(actor, id);
    }

    @PatchMapping("/{id}")
    public BookingResponse change(CurrentUser actor, @PathVariable Long id, @Valid @RequestBody ChangeBookingRequest body) {
        return bookingService.change(actor, id, body);
    }

    @PostMapping("/{id}/cancel")
    public BookingResponse cancel(CurrentUser actor, @PathVariable Long id) {
        return bookingService.cancel(actor, id);
    }

    @PostMapping("/{id}/check-in")
    public BookingResponse checkIn(CurrentUser actor, @PathVariable Long id) {
        return bookingService.checkIn(actor, id);
    }
}
