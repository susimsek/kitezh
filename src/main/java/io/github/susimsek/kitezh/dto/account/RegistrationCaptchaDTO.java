package io.github.susimsek.kitezh.dto.account;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "RegistrationCaptcha", description = "Public registration CAPTCHA settings.")
public record RegistrationCaptchaDTO(
        @Schema(description = "Whether CAPTCHA protection is active.") boolean enabled,
        @Schema(
                        description = "CAPTCHA provider.",
                        allowableValues = {"recaptcha", "enterprise"})
                String provider,
        @Schema(description = "Public site key used by the browser.") String siteKey,
        @Schema(description = "Action sent with score-based CAPTCHA tokens.") String action,
        @Schema(description = "Whether the provider uses invisible score-based v3 mode.")
                boolean recaptchaV3,
        @Schema(description = "Whether scripts are loaded from recaptcha.net.")
                boolean useRecaptchaNet) {}
