package com.deskhive.auth;

import com.deskhive.common.validation.StrongPassword;
import com.deskhive.user.UserResponse;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request and response bodies of /api/auth. Messages match UI-UX.md. */
public final class AuthDtos {

    public static final String EMAIL_MESSAGE = "Enter a valid email, like name@company.com.";
    public static final String EMAIL_PATTERN = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = EMAIL_MESSAGE) @Size(max = 254, message = EMAIL_MESSAGE) String email,
            @NotBlank(message = "Enter your password.") @Size(max = 200, message = "That password is too long.") String password) {
    }

    public record ForgotPasswordRequest(
            @NotBlank(message = EMAIL_MESSAGE) @Size(max = 254, message = EMAIL_MESSAGE)
            @Email(regexp = EMAIL_PATTERN, message = EMAIL_MESSAGE) String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "This link is not valid.") String token,
            @NotNull(message = "Use at least 8 characters, with a number.") @StrongPassword String password) {
    }

    public record AuthResponse(UserResponse user, String accessToken) {
    }

    public record MessageResponse(String message) {
    }
}
