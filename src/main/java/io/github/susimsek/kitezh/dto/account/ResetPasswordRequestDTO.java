package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "ResetPasswordRequest", description = "Request to reset a password with a token.")
public record ResetPasswordRequestDTO(
        @Schema(
                        description = "Single-use token received by email.",
                        example = "eyJhbGciOiJIUzI1NiJ9.reset-token",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(max = 200)
                String token,
        @Schema(
                        description =
                                "New password; must contain at least 12 characters and meet the"
                                        + " configured complexity rules.",
                        example = "Change-me12!",
                        format = "password",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @NotBlank
                @Size(min = 12, max = 128)
                String newPassword,
        @Schema(
                        description =
                                "Optional TOTP code when the password-reset OTP policy requires"
                                        + " it.",
                        example = "123456",
                        requiredMode = Schema.RequiredMode.NOT_REQUIRED)
                @Size(max = 8)
                String otpCode) {}
