package io.github.susimsek.kitezh.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(
        name = "AdminRegistrationCaptchaRequest",
        description = "Registration CAPTCHA settings update.")
public record AdminRegistrationCaptchaRequestDTO(
        @Schema(description = "Enable CAPTCHA verification during registration.") boolean enabled,
        @Schema(
                        description = "CAPTCHA provider.",
                        allowableValues = {"recaptcha", "enterprise"})
                @Pattern(regexp = "(?i)recaptcha|enterprise")
                String provider,
        @Schema(description = "Public CAPTCHA site key.", maxLength = 500) @Size(max = 500)
                String siteKey,
        @Schema(
                        description =
                                "Standard reCAPTCHA secret. Leave blank to preserve the current"
                                        + " value.",
                        maxLength = 2000,
                        writeOnly = true)
                @Size(max = 2000)
                String secretKey,
        @Schema(description = "Google Cloud project ID.", maxLength = 200) @Size(max = 200)
                String projectId,
        @Schema(
                        description =
                                "reCAPTCHA Enterprise API key. Leave blank to preserve the current"
                                        + " value.",
                        maxLength = 2000,
                        writeOnly = true)
                @Size(max = 2000)
                String apiKey,
        @Schema(description = "Score-based action name.", example = "register", maxLength = 100)
                @Pattern(regexp = "[A-Za-z0-9/_]+")
                @Size(max = 100)
                String action,
        @Schema(description = "Use score-based reCAPTCHA v3.") boolean recaptchaV3,
        @Schema(
                        description = "Minimum accepted score between 0 and 1.",
                        minimum = "0",
                        maximum = "1")
                @DecimalMin("0.0")
                @DecimalMax("1.0")
                double scoreThreshold,
        @Schema(description = "Load scripts and cookies from recaptcha.net.")
                boolean useRecaptchaNet,
        @Schema(description = "Enable CAPTCHA verification during login.") boolean loginEnabled,
        @Schema(description = "CAPTCHA action used during login.", example = "login")
                @Pattern(regexp = "[A-Za-z0-9/_]+")
                @Size(max = 100)
                String loginAction,
        @Schema(description = "Use score-based reCAPTCHA v3 during login.")
                boolean loginRecaptchaV3,
        @Schema(
                        description = "Minimum accepted login score between 0 and 1.",
                        minimum = "0",
                        maximum = "1")
                @DecimalMin("0.0")
                @DecimalMax("1.0")
                double loginScoreThreshold) {}
