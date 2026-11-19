package com.deskhive.user;

import org.springframework.http.HttpStatus;

import com.deskhive.common.error.ApiException;

/**
 * The person making the request, loaded fresh from the database for every request (see
 * {@link CurrentUserResolver}). Services receive it as a parameter and check the role themselves.
 */
public record CurrentUser(Long id, String name, Role role, Long officeId, boolean demo) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    /** Role check in the service layer: the first line of every admin operation. */
    public void requireAdmin() {
        if (!isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "This is for admins only.");
        }
    }
}
