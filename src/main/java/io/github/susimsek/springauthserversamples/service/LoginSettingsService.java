package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.dto.account.LoginSettingsDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLoginSettingsDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLoginSettingsRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.WebAuthnPolicyDTO;
import io.github.susimsek.springauthserversamples.mapper.LoginSettingsMapper;
import io.github.susimsek.springauthserversamples.repository.LoginSettingsRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.session.JpaIndexedSessionRepository;
import java.time.Duration;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S6829")
public class LoginSettingsService {

    private static final long SETTINGS_ID = 1L;
    private static final String REQUIRED = "required";
    private final LoginSettingsRepository repository;
    private final AdminAuditEventService auditEventService;
    private final JpaIndexedSessionRepository sessionRepository;
    private final LoginSettingsMapper loginSettingsMapper;
    private final SocialProviderSettingsService socialProviderSettingsService;

    @Transactional(readOnly = true)
    public LoginSettingsDTO publicLoginSettings() {
        LoginSettingsEntity settings = settings();
        return loginSettingsMapper.toPublicDTO(settings);
    }

    @Transactional(readOnly = true)
    public AdminLoginSettingsDTO adminLoginSettings() {
        LoginSettingsEntity settings = settings();
        return loginSettingsMapper.toAdminDTO(settings);
    }

    @Transactional
    @CacheEvict(cacheNames = LoginSettingsRepository.LOGIN_SETTINGS_BY_ID_CACHE, allEntries = true)
    public AdminLoginSettingsDTO update(AdminLoginSettingsRequestDTO request) {
        validateOtpPolicy(request);
        LoginSettingsEntity settings = settings();
        loginSettingsMapper.update(request, settings);
        repository.save(settings);
        if (socialProviderSettingsService != null) {
            socialProviderSettingsService.refreshClientRegistrations();
        }
        if (sessionRepository != null) {
            sessionRepository.setDefaultMaxInactiveInterval(
                    Duration.ofMinutes(settings.getSessionTimeoutMinutes()));
        }
        auditEventService.record("login.settings.updated", "login-settings", "default");
        return loginSettingsMapper.toAdminDTO(settings);
    }

    @Transactional(readOnly = true)
    public boolean isRememberMeEnabled() {
        return settings().isRememberMeEnabled();
    }

    @Transactional(readOnly = true)
    public boolean isUserRegistrationEnabled() {
        return settings().isUserRegistrationEnabled();
    }

    @Transactional(readOnly = true)
    public boolean isForgotPasswordEnabled() {
        return settings().isForgotPasswordEnabled();
    }

    @Transactional(readOnly = true)
    public String passwordResetOtpMode() {
        return settings().getPasswordResetOtpMode();
    }

    @Transactional(readOnly = true)
    public Duration passwordResetTokenLifespan() {
        return Duration.ofSeconds(settings().getPasswordResetTokenLifespanSeconds());
    }

    @Transactional(readOnly = true)
    public Duration passwordResetResendCooldown() {
        return Duration.ofSeconds(settings().getPasswordResetResendCooldownSeconds());
    }

    @Transactional(readOnly = true)
    public boolean isLoginWithEmailEnabled() {
        return settings().isLoginWithEmail();
    }

    @Transactional(readOnly = true)
    public boolean isVerifyEmailEnabled() {
        return settings().isVerifyEmail();
    }

    @Transactional(readOnly = true)
    public Duration emailUpdateReauthenticationAge() {
        return Duration.ofMinutes(settings().getEmailUpdateReauthenticationMinutes());
    }

    @Transactional(readOnly = true)
    public boolean isSocialProviderEnabled(String provider) {
        LoginSettingsEntity value = settings();
        return switch (provider.toLowerCase(Locale.ROOT)) {
            case "google" -> value.isGoogleLoginEnabled();
            case "github" -> value.isGithubLoginEnabled();
            case "linkedin" -> value.isLinkedinLoginEnabled();
            case "microsoft" -> value.isMicrosoftLoginEnabled();
            default -> false;
        };
    }

    @Transactional(readOnly = true)
    public boolean isBruteForceEnabled() {
        return settings().isBruteForceEnabled();
    }

    @Transactional(readOnly = true)
    public int passwordMinimumLength() {
        return settings().getPasswordMinimumLength();
    }

    @Transactional(readOnly = true)
    public int bruteForceMaxFailures() {
        return settings().getBruteForceMaxFailures();
    }

    @Transactional(readOnly = true)
    public int bruteForceMaxSecondaryFailures() {
        return settings().getBruteForceMaxSecondaryFailures();
    }

    @Transactional(readOnly = true)
    public Duration mfaVerificationTimeout() {
        return Duration.ofSeconds(settings().getMfaVerificationTimeoutSeconds());
    }

    @Transactional(readOnly = true)
    public ApplicationProperties.PasswordPolicy passwordPolicy() {
        LoginSettingsEntity value = settings();
        return new ApplicationProperties.PasswordPolicy(
                value.getPasswordMinimumLength(),
                value.getPasswordMaximumLength(),
                value.getPasswordMinimumUppercase(),
                value.getPasswordMinimumLowercase(),
                value.getPasswordMinimumDigits(),
                value.getPasswordMinimumSpecialCharacters(),
                value.isPasswordRejectUsername(),
                value.isPasswordRejectEmail(),
                value.isPasswordRejectCommonPasswords(),
                value.getPasswordHistorySize(),
                value.getPasswordExpirationDays(),
                value.getPasswordCommonPasswords());
    }

    @Transactional(readOnly = true)
    public ApplicationProperties.BruteForce bruteForcePolicy() {
        LoginSettingsEntity value = settings();
        return new ApplicationProperties.BruteForce(
                value.isBruteForceEnabled(),
                value.getBruteForceMaxFailures(),
                Duration.ofMillis(value.getBruteForceQuickLoginWindowMillis()),
                Duration.ofSeconds(value.getBruteForceMinimumQuickLoginWaitSeconds()),
                Duration.ofSeconds(value.getBruteForceWaitIncrementSeconds()),
                Duration.ofSeconds(value.getBruteForceMaxWaitSeconds()),
                Duration.ofSeconds(value.getBruteForceFailureResetTimeSeconds()),
                value.getBruteForceMaxTemporaryLockouts(),
                value.isBruteForcePermanentLockout(),
                value.getBruteForceIpRequestsPerMinute(),
                value.getBruteForceUsernameIpRequestsPerMinute());
    }

    @Transactional(readOnly = true)
    public WebAuthnPolicyDTO webAuthnPolicy(boolean passwordless) {
        return loginSettingsMapper.toWebAuthnPolicy(settings(), passwordless);
    }

    @Transactional(readOnly = true)
    public boolean isOtpAddRecoveryCodesEnabled() {
        return settings().isOtpAddRecoveryCodes();
    }

    @Transactional(readOnly = true)
    public boolean isOtpEnabled() {
        return settings().isOtpEnabled();
    }

    @Transactional(readOnly = true)
    public boolean isOtpRequired() {
        return settings().isOtpRequired();
    }

    @Transactional(readOnly = true)
    public String otpIssuer() {
        return settings().getOtpIssuer();
    }

    @Transactional(readOnly = true)
    public String otpAlgorithm() {
        return settings().getOtpAlgorithm();
    }

    @Transactional(readOnly = true)
    public int otpDigits() {
        return settings().getOtpDigits();
    }

    @Transactional(readOnly = true)
    public int otpPeriodSeconds() {
        return settings().getOtpPeriodSeconds();
    }

    @Transactional(readOnly = true)
    public int otpLookAheadWindow() {
        return settings().getOtpLookAheadWindow();
    }

    @Transactional(readOnly = true)
    public boolean isOtpCodeReusable() {
        return settings().isOtpCodeReusable();
    }

    private LoginSettingsEntity settings() {
        return repository
                .findById(SETTINGS_ID)
                .orElseThrow(() -> new IllegalStateException("Login settings are not initialized"));
    }

    private static void validateOtpPolicy(AdminLoginSettingsRequestDTO request) {
        validateWebAuthnPolicy(request.webauthnPolicy(), "WebAuthn");
        validateWebAuthnPolicy(request.webauthnPasswordlessPolicy(), "WebAuthn passwordless");
        String resetMode = request.passwordResetOtpMode().toLowerCase(Locale.ROOT);
        if (!java.util.Set.of("none", "if-configured", REQUIRED).contains(resetMode)) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "Password-reset OTP mode is invalid");
        }
        if (REQUIRED.equals(resetMode) && !request.otpEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST,
                    "Password-reset OTP cannot be required when OTP is disabled");
        }
        if (request.otpRequired() && !request.otpEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "OTP cannot be required when it is disabled");
        }
        if (request.otpIssuer() == null || request.otpIssuer().isBlank()) {
            throw ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, "OTP issuer is required");
        }
        String algorithm = request.otpAlgorithm();
        if (algorithm == null
                || !java.util.Set.of("SHA1", "SHA256", "SHA512")
                        .contains(algorithm.toUpperCase(Locale.ROOT))) {
            throw ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, "OTP algorithm is invalid");
        }
        if (request.otpDigits() != 6 && request.otpDigits() != 8) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "OTP digits must be 6 or 8");
        }
    }

    private static void validateWebAuthnPolicy(WebAuthnPolicyDTO policy, String label) {
        if (policy == null) {
            throw invalidWebAuthn(label + " policy is required");
        }
        if (policy.rpName() == null || policy.rpName().isBlank()) {
            throw invalidWebAuthn(label + " relying-party name is required");
        }
        if (policy.rpId() != null && policy.rpId().chars().anyMatch(Character::isWhitespace)) {
            throw invalidWebAuthn(label + " relying-party id cannot contain whitespace");
        }
        validateCeremonyRequirements(policy, label);
        if (policy.timeoutSeconds() < 1 || policy.timeoutSeconds() > 86400) {
            throw invalidWebAuthn(label + " timeout must be between 1 and 86400 seconds");
        }
        validateAlgorithms(policy, label);
        validateCeremonyValues(policy, label);
        validateAaguids(policy, label);
    }

    private static void validateCeremonyRequirements(WebAuthnPolicyDTO policy, String label) {
        if (policy.attestation() == null
                || policy.authenticatorAttachment() == null
                || policy.residentKey() == null
                || policy.userVerification() == null) {
            throw invalidWebAuthn(label + " ceremony requirements are required");
        }
    }

    private static void validateAlgorithms(WebAuthnPolicyDTO policy, String label) {
        java.util.Set<String> algorithms =
                csv(policy.signatureAlgorithms()).stream()
                        .map(value -> value.toUpperCase(Locale.ROOT))
                        .collect(java.util.stream.Collectors.toSet());
        if (algorithms.isEmpty()
                || !algorithms.stream()
                        .allMatch(
                                value ->
                                        java.util.Set.of(
                                                        "EDDSA", "ES256", "ES384", "ES512", "RS1",
                                                        "RS256", "RS384", "RS512")
                                                .contains(value))) {
            throw invalidWebAuthn(label + " signature algorithms are invalid");
        }
    }

    private static void validateCeremonyValues(WebAuthnPolicyDTO policy, String label) {
        validateValue(
                policy.attestation(),
                java.util.Set.of("none", "indirect", "direct", "enterprise"),
                label + " attestation is invalid");
        validateValue(
                policy.authenticatorAttachment(),
                java.util.Set.of("any", "platform", "cross-platform"),
                label + " authenticator attachment is invalid");
        validateValue(
                policy.residentKey(),
                java.util.Set.of("discouraged", "preferred", REQUIRED),
                label + " resident key requirement is invalid");
        validateValue(
                policy.userVerification(),
                java.util.Set.of("discouraged", "preferred", REQUIRED),
                label + " user verification requirement is invalid");
    }

    private static void validateValue(String value, java.util.Set<String> allowed, String message) {
        if (!allowed.contains(value.toLowerCase(Locale.ROOT))) {
            throw invalidWebAuthn(message);
        }
    }

    private static void validateAaguids(WebAuthnPolicyDTO policy, String label) {
        for (String aaguid : csv(policy.acceptableAaguids())) {
            try {
                java.util.UUID.fromString(aaguid);
            } catch (IllegalArgumentException _) {
                throw invalidWebAuthn(label + " acceptable AAGUID is invalid");
            }
        }
    }

    private static java.util.List<String> csv(String value) {
        return value == null
                ? java.util.List.of()
                : java.util.Arrays.stream(value.split(","))
                        .map(String::trim)
                        .filter(item -> !item.isBlank())
                        .toList();
    }

    private static ApiException invalidWebAuthn(String message) {
        return ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, message);
    }
}
