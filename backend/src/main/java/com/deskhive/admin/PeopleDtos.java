package com.deskhive.admin;

import java.time.Instant;

import com.deskhive.user.Role;

/** Rows of the People and invites screen. */
public final class PeopleDtos {

    private PeopleDtos() {
    }

    /** What the Status column shows. INVITE_EXPIRED is worked out from the invitation, it is not stored. */
    public enum PersonStatus {
        ACTIVE, INVITE_PENDING, INVITE_EXPIRED, REMOVED
    }

    /**
     * canRemove is true only for an active, non-demo Employee. When it is false, lockedReason says why
     * the screen shows no Remove button: SEED_ONLY (an Admin), DEMO, or null (already removed / invited).
     * invitationId is set for invited people (Resend and Revoke use it).
     */
    public record PersonRow(Long id, String name, String email, Role role, PersonStatus status, Long invitationId,
            Instant inviteExpiresAt, Long officeId, String office, long bookingsThisWeek, boolean demo,
            boolean canRemove, String lockedReason) {
    }
}
