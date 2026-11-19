package com.deskhive.user;

/**
 * The profile the frontend keeps after login. onlyAdmin lets the Profile screen disable "Delete my
 * account" with the right explanation; companyName fills the "Your access to Northwind was removed" texts.
 */
public record UserResponse(
        Long id,
        String name,
        String email,
        Role role,
        OfficeBrief office,
        boolean demo,
        boolean onlyAdmin,
        String companyName) {

    public record OfficeBrief(Long id, String name, String timeZone) {
    }
}
