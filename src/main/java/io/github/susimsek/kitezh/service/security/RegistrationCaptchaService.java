package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.dto.account.RegistrationCaptchaDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaEnterpriseEventDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaEnterpriseRequestDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaEnterpriseResponseDTO;
import io.github.susimsek.kitezh.dto.captcha.CaptchaStandardResponseDTO;
import io.github.susimsek.kitezh.service.client.RegistrationCaptchaClient;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/** Verifies registration CAPTCHA tokens using the Google APIs used by Keycloak. */
@Service
@Slf4j
@RequiredArgsConstructor
public class RegistrationCaptchaService {

    private static final String DEFAULT_ACTION = "register";
    private static final String ENTERPRISE_PROVIDER = "enterprise";

    private final RegistrationCaptchaSettingsService settingsService;
    private final RegistrationCaptchaClient captchaClient;

    public RegistrationCaptchaDTO publicSettings() {
        return publicSettingsInternal(publicConfiguration());
    }

    public RegistrationCaptchaDTO publicLoginSettings() {
        return publicSettingsInternal(loginPublicConfiguration());
    }

    private RegistrationCaptchaDTO publicSettingsInternal(RegistrationCaptchaConfiguration config) {
        if (!isEnabled(config) || !isConfigured(config)) {
            return new RegistrationCaptchaDTO(false, "", "", "", false, false);
        }
        return new RegistrationCaptchaDTO(
                true,
                provider(config),
                config.siteKey().trim(),
                action(config),
                config.recaptchaV3(),
                config.useRecaptchaNet());
    }

    public void verifyOrThrow(String token, HttpServletRequest request) {
        verifyInternal(token, request, verificationConfiguration());
    }

    public void verifyLoginOrThrow(String token, HttpServletRequest request) {
        verifyInternal(token, request, loginVerificationConfiguration());
    }

    private void verifyInternal(
            String token, HttpServletRequest request, RegistrationCaptchaConfiguration config) {
        if (!isEnabled(config)) {
            return;
        }
        if (!isConfigured(config)
                || token == null
                || token.isBlank()
                || !verify(config, token.trim(), request)) {
            throw ApiException.badRequest(
                    "captchaToken", ApiErrorCode.CAPTCHA_FAILED, "CAPTCHA verification failed");
        }
    }

    private boolean verify(
            RegistrationCaptchaConfiguration config, String token, HttpServletRequest request) {
        try {
            return ENTERPRISE_PROVIDER.equals(provider(config))
                    ? verifyEnterprise(config, token, request)
                    : verifyStandard(config, token, request);
        } catch (Exception exception) {
            log.warn("Registration CAPTCHA verification failed", exception);
            return false;
        }
    }

    private boolean verifyStandard(
            RegistrationCaptchaConfiguration config, String token, HttpServletRequest request) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("secret", config.secretKey().trim());
        form.add("response", token);
        if (request.getRemoteAddr() != null && !request.getRemoteAddr().isBlank()) {
            form.add("remoteip", request.getRemoteAddr());
        }
        CaptchaStandardResponseDTO response =
                captchaClient.verify(
                        URI.create("https://www." + domain(config) + "/recaptcha/api/siteverify"),
                        form);
        if (response == null || !response.success()) {
            return false;
        }
        if (!config.recaptchaV3()) {
            return true;
        }
        return actionMatches(response.action(), config)
                && response.score() != null
                && response.score() >= config.scoreThreshold();
    }

    private boolean verifyEnterprise(
            RegistrationCaptchaConfiguration config, String token, HttpServletRequest request) {
        CaptchaEnterpriseEventDTO event =
                new CaptchaEnterpriseEventDTO(
                        token,
                        config.siteKey().trim(),
                        request.getHeader("User-Agent"),
                        request.getRemoteAddr(),
                        action(config));
        CaptchaEnterpriseResponseDTO response =
                captchaClient.assess(
                        URI.create(
                                "https://recaptchaenterprise.googleapis.com/v1/projects/"
                                        + config.projectId().trim()
                                        + "/assessments?key="
                                        + config.apiKey().trim()),
                        new CaptchaEnterpriseRequestDTO(event));
        if (response == null
                || response.tokenProperties() == null
                || response.riskAnalysis() == null
                || response.event() == null) {
            return false;
        }
        return response.tokenProperties().valid()
                && actionMatches(
                        response.tokenProperties().action(), response.event().expectedAction())
                && response.riskAnalysis().score() >= config.scoreThreshold();
    }

    private static boolean isConfigured(RegistrationCaptchaConfiguration config) {
        if ("recaptcha".equals(provider(config))) {
            return present(config.siteKey())
                    && present(config.secretKey())
                    && (!config.recaptchaV3()
                            || (validAction(action(config))
                                    && validScoreThreshold(config.scoreThreshold())));
        }
        return ENTERPRISE_PROVIDER.equals(provider(config))
                && present(config.siteKey())
                && present(config.projectId())
                && present(config.apiKey())
                && validAction(action(config))
                && validScoreThreshold(config.scoreThreshold());
    }

    private static boolean isEnabled(RegistrationCaptchaConfiguration config) {
        return config.enabled()
                && ("recaptcha".equals(provider(config))
                        || ENTERPRISE_PROVIDER.equals(provider(config)));
    }

    private static boolean actionMatches(String actual, RegistrationCaptchaConfiguration config) {
        return actionMatches(actual, action(config));
    }

    private static boolean actionMatches(String actual, String expected) {
        return actual != null && actual.equals(expected);
    }

    private static boolean validScoreThreshold(double scoreThreshold) {
        return scoreThreshold >= 0.0 && scoreThreshold <= 1.0;
    }

    private static boolean validAction(String action) {
        return action != null && action.matches("[A-Za-z0-9/_]+");
    }

    private static boolean present(String value) {
        return value != null && !value.isBlank();
    }

    private static String provider(RegistrationCaptchaConfiguration config) {
        return config.provider() == null
                ? "disabled"
                : config.provider().trim().toLowerCase(Locale.ROOT);
    }

    private static String action(RegistrationCaptchaConfiguration config) {
        return present(config.action()) ? config.action().trim() : DEFAULT_ACTION;
    }

    private static String domain(RegistrationCaptchaConfiguration config) {
        return config.useRecaptchaNet() ? "recaptcha.net" : "google.com";
    }

    private RegistrationCaptchaConfiguration publicConfiguration() {
        return settingsService.publicConfiguration();
    }

    private RegistrationCaptchaConfiguration verificationConfiguration() {
        return settingsService.verificationConfiguration();
    }

    private RegistrationCaptchaConfiguration loginPublicConfiguration() {
        return settingsService.loginPublicConfiguration();
    }

    private RegistrationCaptchaConfiguration loginVerificationConfiguration() {
        return settingsService.loginVerificationConfiguration();
    }
}
