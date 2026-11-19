package com.deskhive.invitation;

import java.time.Instant;

import com.deskhive.auth.AuthDtos;
import com.deskhive.common.validation.StrongPassword;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Bodies of the public invitation endpoints and of the Admin's "Invite people". */
public final class InvitationDtos {

    private InvitationDtos() {
    }

    /** What the accept page shows before the person sets a name and password. */
    public record InvitationInfo(String email, String inviterName, String officeName, String timeZone,
            Instant expiresAt, String companyName) {
    }

    public record AcceptInvitationRequest(
            @NotBlank(message = "Enter your name.") @Size(max = 80, message = "Use at most 80 characters.") String name,
            @NotNull(message = "Use at least 8 characters, with a number.") @StrongPassword String password) {
    }

    public record InviteRequest(
            @NotBlank(message = AuthDtos.EMAIL_MESSAGE) @Size(max = 254, message = AuthDtos.EMAIL_MESSAGE)
            @Email(regexp = AuthDtos.EMAIL_PATTERN, message = AuthDtos.EMAIL_MESSAGE) String email,
            @NotNull(message = "Pick an office.") Long officeId) {
    }
}
