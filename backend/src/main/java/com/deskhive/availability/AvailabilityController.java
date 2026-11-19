package com.deskhive.availability;

import java.time.LocalDate;
import java.time.LocalTime;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.availability.AvailabilityDtos.AvailabilityResponse;
import com.deskhive.availability.AvailabilityDtos.RoomDayResponse;
import com.deskhive.availability.AvailabilityDtos.SeatMapResponse;
import com.deskhive.user.CurrentUser;

/** Search for a free desk or room. Open to every logged-in person; nobody's name is ever returned. */
@RestController
@RequestMapping("/api")
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    public AvailabilityController(AvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    @GetMapping("/availability")
    public AvailabilityResponse search(CurrentUser actor, @RequestParam Long officeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime to) {
        return availabilityService.search(officeId, date, from, to);
    }

    @GetMapping("/floors/{floorId}/seat-map")
    public SeatMapResponse seatMap(CurrentUser actor, @PathVariable Long floorId,
            @RequestParam(required = false) String area,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime to) {
        return availabilityService.seatMap(actor, floorId, area, date, from, to);
    }

    @GetMapping("/rooms/{id}")
    public RoomDayResponse room(CurrentUser actor, @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return availabilityService.roomDay(actor, id, date);
    }
}
