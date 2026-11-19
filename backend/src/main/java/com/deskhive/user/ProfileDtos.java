package com.deskhive.user;

import com.deskhive.common.validation.StrongPassword;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies of /api/me. The email and the office can't be changed (UI-UX.md, Profile). */
public final class ProfileDtos {

    private ProfileDtos() {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "Enter your name.") @Size(max = 80, message = "Use at most 80 characters.") String name) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter your current password.") @Size(max = 200, message = "That password isn't right.") String currentPassword,
            @NotNull(message = "Use at least 8 characters, with a number.") @StrongPassword String newPassword) {
    }

    public record DeleteAccountRequest(
            @NotBlank(message = "Enter your password.") @Size(max = 200, message = "That password isn't right.") String password) {
    }

    public record PasswordChangedResponse(String accessToken) {
    }
}
