package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        name = "AdminRegistrationCaptcha",
        description = "Registration CAPTCHA settings without secret values.")
public record AdminRegistrationCaptchaDTO(
        @Schema(description = "Enable CAPTCHA verification during registration.") boolean enabled,
        @Schema(
                        description = "CAPTCHA provider.",
                        allowableValues = {"recaptcha", "enterprise"})
                String provider,
        @Schema(description = "Public CAPTCHA site key.") String siteKey,
        @Schema(description = "Google Cloud project ID for reCAPTCHA Enterprise.") String projectId,
        @Schema(description = "Score-based action name.") String action,
        @Schema(description = "Use score-based reCAPTCHA v3 instead of the visible v2 checkbox.")
                boolean recaptchaV3,
        @Schema(
                        description = "Minimum accepted score between 0 and 1.",
                        minimum = "0",
                        maximum = "1")
                double scoreThreshold,
        @Schema(description = "Load scripts and cookies from recaptcha.net.")
                boolean useRecaptchaNet,
        @Schema(description = "Whether the standard reCAPTCHA secret is configured.")
                boolean secretConfigured,
        @Schema(description = "Whether the Enterprise API key is configured.")
                boolean apiKeyConfigured,
        @Schema(description = "Enable CAPTCHA verification during login.") boolean loginEnabled,
        @Schema(description = "CAPTCHA action used during login.") String loginAction,
        @Schema(description = "Use score-based reCAPTCHA v3 during login.")
                boolean loginRecaptchaV3,
        @Schema(
                        description = "Minimum accepted login score between 0 and 1.",
                        minimum = "0",
                        maximum = "1")
                double loginScoreThreshold) {}
