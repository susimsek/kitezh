package io.github.susimsek.springauthserversamples.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminLoginSettings", description = "Application-wide public login settings.")
public record AdminLoginSettingsDTO(
        @Schema(description = "Allow visitors to create accounts.") boolean userRegistration,
        @Schema(description = "Show the forgot-password link and allow password reset requests.")
                boolean forgotPassword,
        @Schema(
                        description =
                                "OTP policy during password reset: none, if-configured, or"
                                        + " required.",
                        allowableValues = {"none", "if-configured", "required"})
                String passwordResetOtpMode,
        @Schema(description = "Password-reset token lifetime in seconds.", minimum = "60")
                int passwordResetTokenLifespanSeconds,
        @Schema(description = "Minimum seconds between reset-email requests.", minimum = "0")
                int passwordResetResendCooldownSeconds,
        @Schema(description = "Show and honor the remember-me option on the login form.")
                boolean rememberMe,
        @Schema(description = "Allow email addresses as login identifiers.") boolean loginWithEmail,
        @Schema(description = "Require verified email addresses for new accounts.")
                boolean verifyEmail,
        @Schema(
                        description =
                                "WebAuthn credential mediation: none, optional, or conditional.",
                        allowableValues = {"none", "optional", "conditional"})
                String webauthnMediation,
        @Schema(
                        description =
                                "Maximum age of authentication before an email change requires"
                                        + " current-password confirmation.",
                        minimum = "0")
                int emailUpdateReauthenticationMinutes,
        @Schema(description = "Allow Google social sign-in.") boolean googleLoginEnabled,
        @Schema(description = "Allow GitHub social sign-in.") boolean githubLoginEnabled,
        @Schema(description = "Allow LinkedIn social sign-in.") boolean linkedinLoginEnabled,
        @Schema(description = "Allow Microsoft social sign-in.") boolean microsoftLoginEnabled,
        @Schema(description = "Maximum browser session duration in minutes.", minimum = "1")
                int sessionTimeoutMinutes,
        @Schema(description = "Minimum accepted password length.", minimum = "8")
                int passwordMinimumLength,
        @Schema(description = "Enable protection against repeated failed logins.")
                boolean bruteForceEnabled,
        @Schema(description = "Failed login threshold before throttling.", minimum = "1")
                int bruteForceMaxFailures,
        @Schema(
                        description =
                                "Maximum failed MFA challenges before permanent account lockout."
                                        + " Set to zero to disable.",
                        minimum = "0")
                int bruteForceMaxSecondaryFailures,
        @Schema(description = "MFA verification validity in seconds.", minimum = "1")
                int mfaVerificationTimeoutSeconds,
        @Schema(description = "Maximum accepted password length.", minimum = "1")
                int passwordMaximumLength,
        @Schema(description = "Minimum uppercase characters in a password.", minimum = "0")
                int passwordMinimumUppercase,
        @Schema(description = "Minimum lowercase characters in a password.", minimum = "0")
                int passwordMinimumLowercase,
        @Schema(description = "Minimum digits in a password.", minimum = "0")
                int passwordMinimumDigits,
        @Schema(description = "Minimum special characters in a password.", minimum = "0")
                int passwordMinimumSpecialCharacters,
        @Schema(description = "Reject passwords equal to the username.")
                boolean passwordRejectUsername,
        @Schema(description = "Reject passwords equal to the email address.")
                boolean passwordRejectEmail,
        @Schema(description = "Reject passwords from the common-password list.")
                boolean passwordRejectCommonPasswords,
        @Schema(description = "Number of previous passwords that cannot be reused.", minimum = "0")
                int passwordHistorySize,
        @Schema(description = "Password lifetime in days; zero disables expiration.", minimum = "0")
                int passwordExpirationDays,
        @Schema(description = "Comma-separated common passwords rejected by policy.")
                String passwordCommonPasswords,
        @Schema(description = "Quick-login interval in milliseconds.", minimum = "0")
                int bruteForceQuickLoginWindowMillis,
        @Schema(description = "Minimum quick-login lock wait in seconds.", minimum = "0")
                int bruteForceMinimumQuickLoginWaitSeconds,
        @Schema(description = "Additional lock wait per failure in seconds.", minimum = "0")
                int bruteForceWaitIncrementSeconds,
        @Schema(description = "Maximum brute-force lock wait in seconds.", minimum = "0")
                int bruteForceMaxWaitSeconds,
        @Schema(description = "Failure counter reset period in seconds.", minimum = "0")
                int bruteForceFailureResetTimeSeconds,
        @Schema(description = "Maximum temporary lockouts before permanent lockout.", minimum = "0")
                int bruteForceMaxTemporaryLockouts,
        @Schema(description = "Permanently lock accounts after brute-force detection.")
                boolean bruteForcePermanentLockout,
        @Schema(description = "Allowed login requests per IP per minute.", minimum = "1")
                int bruteForceIpRequestsPerMinute,
        @Schema(
                        description = "Allowed login requests per username and IP per minute.",
                        minimum = "1")
                int bruteForceUsernameIpRequestsPerMinute,
        @Schema(description = "Allow users to enroll a TOTP authenticator.") boolean otpEnabled,
        @Schema(description = "Require TOTP after password authentication.") boolean otpRequired,
        @Schema(description = "Issuer label shown in authenticator applications.") String otpIssuer,
        @Schema(description = "TOTP algorithm (SHA1, SHA256, or SHA512).") String otpAlgorithm,
        @Schema(description = "TOTP code length (6 or 8).", minimum = "6", maximum = "8")
                int otpDigits,
        @Schema(description = "TOTP period in seconds.", minimum = "15") int otpPeriodSeconds,
        @Schema(description = "Accepted clock drift window in adjacent periods.", minimum = "0")
                int otpLookAheadWindow,
        @Schema(description = "Allow the same TOTP code to be used more than once.")
                boolean otpCodeReusable,
        @Schema(description = "Request recovery codes after OTP setup.")
                boolean otpAddRecoveryCodes,
        @Schema(
                        description = "Show a warning when unused recovery codes reach this count.",
                        minimum = "0")
                int recoveryCodeWarningThreshold,
        @Schema(
                        description = "Allow passkey sign-in on the public login page.",
                        example = "true",
                        requiredMode = Schema.RequiredMode.REQUIRED)
                boolean passkeys,
        @Schema(description = "Registration WebAuthn policy.") WebAuthnPolicyDTO webauthnPolicy,
        @Schema(description = "Passwordless authentication WebAuthn policy.")
                WebAuthnPolicyDTO webauthnPasswordlessPolicy) {

    public AdminLoginSettingsDTO(
            boolean userRegistration,
            boolean forgotPassword,
            boolean rememberMe,
            boolean loginWithEmail,
            boolean verifyEmail,
            int sessionTimeoutMinutes,
            int passwordMinimumLength,
            boolean bruteForceEnabled,
            int bruteForceMaxFailures,
            int bruteForceMaxSecondaryFailures,
            boolean otpEnabled,
            boolean otpRequired,
            String otpIssuer,
            String otpAlgorithm,
            int otpDigits,
            int otpPeriodSeconds,
            int otpLookAheadWindow,
            boolean otpCodeReusable,
            boolean otpAddRecoveryCodes,
            int recoveryCodeWarningThreshold) {
        this(
                userRegistration,
                forgotPassword,
                "none",
                43200,
                30,
                rememberMe,
                loginWithEmail,
                verifyEmail,
                "none",
                5,
                true,
                true,
                true,
                false,
                sessionTimeoutMinutes,
                passwordMinimumLength,
                bruteForceEnabled,
                bruteForceMaxFailures,
                bruteForceMaxSecondaryFailures,
                300,
                128,
                1,
                1,
                1,
                1,
                true,
                true,
                true,
                5,
                90,
                "password,123456,12345678,qwerty,qwerty123,admin,letmein",
                1000,
                60,
                60,
                900,
                43200,
                3,
                false,
                30,
                5,
                otpEnabled,
                otpRequired,
                otpIssuer,
                otpAlgorithm,
                otpDigits,
                otpPeriodSeconds,
                otpLookAheadWindow,
                otpCodeReusable,
                otpAddRecoveryCodes,
                recoveryCodeWarningThreshold,
                true,
                new WebAuthnPolicyDTO(
                        "Kitezh",
                        "",
                        "ES256,RS256,EdDSA",
                        "none",
                        "any",
                        "preferred",
                        "preferred",
                        300,
                        true,
                        ""),
                new WebAuthnPolicyDTO(
                        "Kitezh",
                        "",
                        "ES256,RS256,EdDSA",
                        "none",
                        "any",
                        "required",
                        "required",
                        300,
                        true,
                        ""));
    }
}
