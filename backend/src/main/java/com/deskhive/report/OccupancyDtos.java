package com.deskhive.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.deskhive.common.web.PageResponse;
import com.deskhive.office.SpaceType;

/**
 * The occupancy and utilisation report for one office and one week (Monday to Sunday, in the office's
 * time zone). Percentages are BigDecimal with one decimal ("62.5"), never floating point; they are null
 * when there is nothing to divide by (an office with no desks).
 */
public final class OccupancyDtos {

    private OccupancyDtos() {
    }

    /** One bar of "desks booked per day". */
    public record DayCount(LocalDate date, long desksBooked) {
    }

    /**
     * deskDaysBooked / deskDaysAvailable: desk use = desk-days booked (a desk with at least one active
     * booking that day) over desks x 7 open days. roomHoursBooked / roomHoursAvailable: room use = booked
     * hours over rooms x open hours x 7. noShows = bookings auto-released. busiestDay = the day with most desks booked.
     */
    public record Kpis(BigDecimal deskUse, long deskDaysBooked, long deskDaysAvailable,
            BigDecimal roomUse, BigDecimal roomHoursBooked, BigDecimal roomHoursAvailable,
            long noShows, LocalDate busiestDay, long busiestDayDesksBooked, long bookings) {
    }

    /** One row of the "By space" table. bookedUnits: desk-days for a desk, hours for a room. */
    public record SpaceUse(Long spaceId, SpaceType type, String label, String floor, long bookings,
            BigDecimal bookedUnits, BigDecimal use, long noShows) {
    }

    public record OccupancyResponse(Long officeId, String office, Long floorId, String floor, String timeZone,
            LocalDate weekStart, LocalDate weekEnd, int desks, int rooms, Kpis kpis, List<DayCount> desksBookedByDay,
            PageResponse<SpaceUse> bySpace) {
    }
}
