package com.deskhive.report;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.common.web.PageQuery;
import com.deskhive.report.OccupancyDtos.OccupancyResponse;
import com.deskhive.user.CurrentUser;

/** Admin: occupancy and utilisation for one office and one week. */
@RestController
@RequestMapping("/api/admin/occupancy")
public class OccupancyController {

    private final OccupancyService occupancyService;

    public OccupancyController(OccupancyService occupancyService) {
        this.occupancyService = occupancyService;
    }

    /** weekStart is any day of the week wanted (it is moved back to that week's Monday); default: this week. */
    @GetMapping
    public OccupancyResponse report(CurrentUser actor, @RequestParam Long officeId,
            @RequestParam(required = false) Long floorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return occupancyService.report(actor, officeId, floorId, weekStart, PageQuery.unsorted(page, size));
    }
}
