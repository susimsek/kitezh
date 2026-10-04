package io.github.susimsek.kitezh.service.security;

/** Runtime registration CAPTCHA settings resolved from the administrator-managed settings row. */
public record RegistrationCaptchaConfiguration(
        boolean enabled,
        String provider,
        String siteKey,
        String secretKey,
        String projectId,
        String apiKey,
        String action,
        boolean recaptchaV3,
        double scoreThreshold,
        boolean useRecaptchaNet) {}
