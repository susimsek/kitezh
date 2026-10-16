package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@Schema(
        name = "NativeAdminLoginSettingsRequest",
        description = "Bounded login-policy fields editable by the native administration client.")
public record NativeAdminLoginSettingsRequestDTO(
        @Schema(
                        description = "Allow visitors to create accounts.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean userRegistration,
        @Schema(
                        description = "Allow password-reset requests.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean forgotPassword,
        @Schema(
                        description = "Show and honor the remember-me option.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean rememberMe,
        @Schema(
                        description = "Allow email addresses as login identifiers.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean loginWithEmail,
        @Schema(
                        description = "Require verified email addresses for new accounts.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean verifyEmail,
        @Schema(
                        description = "Maximum browser session duration in minutes.",
                        example = "30",
                        minimum = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(1)
                @Max(1440)
                int sessionTimeoutMinutes,
        @Schema(
                        description = "Minimum accepted password length.",
                        example = "12",
                        minimum = "8",
                        maximum = "128",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(8)
                @Max(128)
                int passwordMinimumLength,
        @Schema(
                        description = "Enable protection against repeated failed logins.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean bruteForceEnabled,
        @Schema(
                        description = "Failed login threshold before throttling.",
                        example = "5",
                        minimum = "1",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                @Min(1)
                @Max(100)
                int bruteForceMaxFailures,
        @Schema(
                        description = "Allow users to enroll a TOTP authenticator.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean otpEnabled,
        @Schema(
                        description = "Require TOTP after password authentication.",
                        example = "false",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean otpRequired,
        @Schema(
                        description = "Allow passkey sign-in.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean passkeys) {}
