package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "LoginSettings", description = "Public login-page feature switches.")
public record LoginSettingsDTO(
        @Schema(description = "Whether visitors can create accounts.") boolean userRegistration,
        @Schema(description = "Whether users can request password reset emails.")
                boolean forgotPassword,
        @Schema(
                        description =
                                "OTP policy during password reset: none, if-configured, or"
                                        + " required.",
                        allowableValues = {"none", "if-configured", "required"})
                String passwordResetOtpMode,
        @Schema(description = "Whether the login page offers remember-me sessions.")
                boolean rememberMe,
        @Schema(
                        description = "Whether the login page offers passkey sign-in.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean passkeys,
        @Schema(
                        description =
                                "WebAuthn credential mediation used by the login page: none,"
                                        + " optional, or conditional.",
                        allowableValues = {"none", "optional", "conditional"})
                String webauthnMediation) {}
