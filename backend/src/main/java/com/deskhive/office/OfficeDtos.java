package com.deskhive.office;

import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import com.deskhive.common.validation.ValidTimeZone;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Bodies of the office, floor, desk and room endpoints. Messages match UI-UX.md. */
public final class OfficeDtos {

    private OfficeDtos() {
    }

    // ---- Offices ----

    /** opensAt and closesAt are optional: the defaults are 08:00 and 19:00. */
    public record CreateOfficeRequest(
            @NotBlank(message = "Enter the office name.") @Size(max = 80, message = "Use at most 80 characters.") String name,
            @NotBlank(message = "Enter the address.") @Size(max = 200, message = "Use at most 200 characters.") String address,
            @NotBlank(message = "Pick a time zone from the list, like Asia/Kolkata.") @ValidTimeZone String timeZone,
            LocalTime opensAt,
            LocalTime closesAt) {
    }

    /** The time zone is not here on purpose: it can't be changed after the office is created. */
    public record UpdateOfficeRequest(
            @NotBlank(message = "Enter the office name.") @Size(max = 80, message = "Use at most 80 characters.") String name,
            @NotBlank(message = "Enter the address.") @Size(max = 200, message = "Use at most 200 characters.") String address) {
    }

    public record RulesRequest(
            @NotNull(message = "Pick the opening time.") LocalTime opensAt,
            @NotNull(message = "Pick the closing time.") LocalTime closesAt,
            @NotNull(message = "Enter a number of days from 1 to 60.")
            @Min(value = 1, message = "Enter a number of days from 1 to 60.")
            @Max(value = 60, message = "Enter a number of days from 1 to 60.") Integer bookAheadDays,
            @NotNull(message = "Enter the longest booking in hours.")
            @Min(value = 1, message = "Enter at least 1 hour.") Integer maxBookingHours) {
    }

    public record Rules(LocalTime opensAt, LocalTime closesAt, int bookAheadDays, int maxBookingHours,
            boolean oneDeskADay) {
    }

    public record FloorSummary(Long id, String name, long desks, long rooms) {
    }

    public record OfficeResponse(Long id, String name, String address, String timeZone, String timeZoneName,
            Rules rules, List<FloorSummary> floors) {
    }

    // ---- Floors ----

    public record CreateFloorRequest(
            @NotNull(message = "Pick an office.") Long officeId,
            @NotBlank(message = "Enter the floor name.") @Size(max = 60, message = "Use at most 60 characters.") String name) {
    }

    public record RenameFloorRequest(
            @NotBlank(message = "Enter the floor name.") @Size(max = 60, message = "Use at most 60 characters.") String name) {
    }

    // ---- Desks and rooms ----

    public record DeskRequest(
            @NotNull(message = "Pick a floor.") Long floorId,
            @NotBlank(message = "Enter the area, like Quiet zone.") @Size(max = 60, message = "Use at most 60 characters.") String area,
            @NotBlank(message = "Enter a row letter, like B.") @Pattern(regexp = "^[A-Za-z]$", message = "Use a single letter, like B.") String row,
            @NotNull(message = "Enter a seat number from 1 to 99.")
            @Min(value = 1, message = "Enter a seat number from 1 to 99.")
            @Max(value = 99, message = "Enter a seat number from 1 to 99.") Integer number,
            Set<Feature> features) {
    }

    public record RoomRequest(
            @NotNull(message = "Pick a floor.") Long floorId,
            @NotBlank(message = "Enter the room name.") @Size(max = 80, message = "Use at most 80 characters.") String name,
            @NotNull(message = "Enter a capacity from 1 to 50.")
            @Min(value = 1, message = "Enter a capacity from 1 to 50.")
            @Max(value = 50, message = "Enter a capacity from 1 to 50.") Integer capacity,
            Set<Feature> features) {
    }

    public record SpaceResponse(Long id, SpaceType type, Long floorId, String floor, Long officeId, String label,
            String area, String row, Integer number, String name, Integer capacity, Set<Feature> features) {
    }
}
