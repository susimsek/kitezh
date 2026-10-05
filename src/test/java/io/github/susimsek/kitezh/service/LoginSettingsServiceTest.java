package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsRequestDTO;
import io.github.susimsek.kitezh.dto.admin.WebAuthnPolicyDTO;
import io.github.susimsek.kitezh.mapper.LoginSettingsMapper;
import io.github.susimsek.kitezh.repository.LoginSettingsRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

@SuppressWarnings({"java:S5778", "java:S5961"})
class LoginSettingsServiceTest {

    private final LoginSettingsRepository repository = mock(LoginSettingsRepository.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private LoginSettingsEntity settings;
    private LoginSettingsService service;

    @BeforeEach
    void setUp() {
        settings = settings();
        when(repository.findById(1L)).thenReturn(Optional.of(settings));
        service =
                new LoginSettingsService(
                        repository,
                        auditEventService,
                        null,
                        Mappers.getMapper(LoginSettingsMapper.class),
                        null);
    }

    @Test
    void exposesPublicAdminAndPolicyValues() {
        assertThat(
                        new LoginSettingsService(
                                repository,
                                auditEventService,
                                mock(JpaIndexedSessionRepository.class),
                                Mappers.getMapper(LoginSettingsMapper.class),
                                null))
                .isNotNull();
        assertThat(service.publicLoginSettings().userRegistration()).isTrue();
        assertThat(service.adminLoginSettings().passwordMinimumLength()).isEqualTo(12);
        assertThat(service.isRememberMeEnabled()).isTrue();
        assertThat(service.isUserRegistrationEnabled()).isTrue();
        assertThat(service.isForgotPasswordEnabled()).isTrue();
        assertThat(service.passwordResetOtpMode()).isEqualTo("if-configured");
        assertThat(service.passwordResetTokenLifespan()).isEqualTo(Duration.ofSeconds(600));
        assertThat(service.passwordResetResendCooldown()).isEqualTo(Duration.ofSeconds(30));
        assertThat(service.isLoginWithEmailEnabled()).isTrue();
        assertThat(service.isVerifyEmailEnabled()).isTrue();
        assertThat(service.emailUpdateReauthenticationAge()).isEqualTo(Duration.ofMinutes(5));
        assertThat(service.isSocialProviderEnabled("GOOGLE")).isTrue();
        assertThat(service.isSocialProviderEnabled("github")).isFalse();
        assertThat(service.isSocialProviderEnabled("unknown")).isFalse();
        assertThat(service.isBruteForceEnabled()).isTrue();
        assertThat(service.passwordMinimumLength()).isEqualTo(12);
        assertThat(service.bruteForceMaxFailures()).isEqualTo(5);
        assertThat(service.bruteForceMaxSecondaryFailures()).isEqualTo(2);
        assertThat(service.mfaVerificationTimeout()).isEqualTo(Duration.ofSeconds(300));
        assertThat(service.passwordPolicy().maximumLength()).isEqualTo(128);
        assertThat(service.bruteForcePolicy().maxFailures()).isEqualTo(5);
        assertThat(service.webAuthnPolicy(false).rpName()).isEqualTo("Sample");
        assertThat(service.webAuthnPolicy(true).rpName()).isEqualTo("Passwordless");
        assertThat(service.isOtpAddRecoveryCodesEnabled()).isTrue();
        assertThat(service.isOtpEnabled()).isTrue();
        assertThat(service.isOtpRequired()).isTrue();
        assertThat(service.otpIssuer()).isEqualTo("Issuer");
        assertThat(service.otpAlgorithm()).isEqualTo("SHA256");
        assertThat(service.otpDigits()).isEqualTo(6);
        assertThat(service.otpPeriodSeconds()).isEqualTo(30);
        assertThat(service.otpLookAheadWindow()).isEqualTo(1);
        assertThat(service.isOtpCodeReusable()).isTrue();
    }

    @Test
    void updatesSettingsAndRecordsAudit() {
        AdminLoginSettingsRequestDTO request =
                new AdminLoginSettingsRequestDTO(
                        false,
                        false,
                        true,
                        false,
                        false,
                        45,
                        14,
                        false,
                        7,
                        1,
                        true,
                        false,
                        "New Issuer",
                        "SHA512",
                        8,
                        60,
                        2,
                        true,
                        false,
                        4);

        assertThat(service.update(request).userRegistration()).isFalse();
        assertThat(settings.getSessionTimeoutMinutes()).isEqualTo(45);
        assertThat(settings.getOtpIssuer()).isEqualTo("New Issuer");
        verify(repository).save(settings);
        verify(auditEventService).record("login.settings.updated", "login-settings", "default");
    }

    @Test
    void rejectsMissingSettings() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(service::publicLoginSettings)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not initialized");
    }

    @Test
    void updatesSettingsAndRefreshesSessionsAndSocialProviders() {
        JpaIndexedSessionRepository sessionRepository = mock(JpaIndexedSessionRepository.class);
        SocialProviderSettingsService socialProviderSettingsService =
                mock(SocialProviderSettingsService.class);
        LoginSettingsService configuredService =
                new LoginSettingsService(
                        repository,
                        auditEventService,
                        sessionRepository,
                        Mappers.getMapper(LoginSettingsMapper.class),
                        socialProviderSettingsService);

        configuredService.update(validRequest());

        verify(sessionRepository).setDefaultMaxInactiveInterval(Duration.ofMinutes(45));
        verify(socialProviderSettingsService).refreshClientRegistrations();
    }

    @Test
    void rejectsInvalidOtpPolicies() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "invalid",
                                                true,
                                                true,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password-reset OTP mode is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "required",
                                                false,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password-reset OTP cannot be required when OTP is disabled");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                false,
                                                true,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("OTP cannot be required when it is disabled");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "",
                                                "SHA1",
                                                6,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("OTP issuer is required");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "MD5",
                                                6,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("OTP algorithm is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                7,
                                                validPolicy(),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("OTP digits must be 6 or 8");
    }

    @Test
    void rejectsInvalidWebAuthnPolicies() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                null,
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn policy is required");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        " ",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn relying-party name is required");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "bad id",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn relying-party id cannot contain whitespace");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn signature algorithms are invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "bad",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn attestation is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "bad",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn authenticator attachment is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "bad",
                                                        "preferred",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn resident key requirement is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "bad",
                                                        300,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn user verification requirement is invalid");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        "not-a-guid"),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn acceptable AAGUID is invalid");
    }

    @Test
    void rejectsWebAuthnTimeoutAndMissingCeremonyRequirements() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        0,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn timeout must be between 1 and 86400 seconds");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                policy(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        86401,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn timeout must be between 1 and 86400 seconds");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                new WebAuthnPolicyDTO(
                                                        "Example",
                                                        "example.test",
                                                        "ES256",
                                                        null,
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        true,
                                                        ""),
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn ceremony requirements are required");
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                validPolicy(),
                                                policy(
                                                        "Passwordless",
                                                        "example.test",
                                                        "ES256",
                                                        "none",
                                                        "any",
                                                        "preferred",
                                                        "preferred",
                                                        300,
                                                        "not-a-guid"))))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn passwordless acceptable AAGUID is invalid");
    }

    @Test
    void coversRemainingWebAuthnPolicyBoundaries() {
        assertThatThrownBy(
                        () ->
                                service.update(
                                        request(
                                                "none",
                                                true,
                                                false,
                                                "Issuer",
                                                "SHA1",
                                                6,
                                                null,
                                                validPolicy())))
                .isInstanceOf(ApiException.class)
                .hasMessage("WebAuthn policy is required");

        WebAuthnPolicyDTO nullRpId =
                new WebAuthnPolicyDTO(
                        "Example",
                        null,
                        "ES256",
                        "none",
                        "any",
                        "preferred",
                        "preferred",
                        300,
                        true,
                        "00000000-0000-0000-0000-000000000000");
        service.update(request("none", true, false, "Issuer", "SHA1", 6, nullRpId, validPolicy()));

        for (WebAuthnPolicyDTO policy :
                java.util.List.of(
                        new WebAuthnPolicyDTO(
                                "Example",
                                "example.test",
                                "ES256",
                                "none",
                                null,
                                "preferred",
                                "preferred",
                                300,
                                true,
                                ""),
                        new WebAuthnPolicyDTO(
                                "Example",
                                "example.test",
                                "ES256",
                                "none",
                                "any",
                                null,
                                "preferred",
                                300,
                                true,
                                ""),
                        new WebAuthnPolicyDTO(
                                "Example",
                                "example.test",
                                "ES256",
                                "none",
                                "any",
                                "preferred",
                                null,
                                300,
                                true,
                                ""))) {
            assertThatThrownBy(
                            () ->
                                    service.update(
                                            request(
                                                    "none",
                                                    true,
                                                    false,
                                                    "Issuer",
                                                    "SHA1",
                                                    6,
                                                    policy,
                                                    validPolicy())))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("WebAuthn ceremony requirements are required");
        }
    }

    private static AdminLoginSettingsRequestDTO validRequest() {
        return request("none", true, false, "Issuer", "SHA1", 6, validPolicy(), validPolicy());
    }

    private static AdminLoginSettingsRequestDTO request(
            String resetMode,
            boolean otpEnabled,
            boolean otpRequired,
            String issuer,
            String algorithm,
            int digits,
            WebAuthnPolicyDTO webAuthnPolicy,
            WebAuthnPolicyDTO passwordlessPolicy) {
        return new AdminLoginSettingsRequestDTO(
                true,
                true,
                resetMode,
                600,
                30,
                true,
                true,
                true,
                "none",
                5,
                true,
                false,
                true,
                false,
                45,
                12,
                true,
                5,
                2,
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
                "password",
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
                issuer,
                algorithm,
                digits,
                30,
                1,
                true,
                true,
                2,
                true,
                webAuthnPolicy,
                passwordlessPolicy);
    }

    private static WebAuthnPolicyDTO validPolicy() {
        return policy(
                "Example",
                "example.test",
                "ES256,RS256",
                "none",
                "any",
                "preferred",
                "preferred",
                300,
                "");
    }

    private static WebAuthnPolicyDTO policy(
            String rpName,
            String rpId,
            String algorithms,
            String attestation,
            String attachment,
            String residentKey,
            String userVerification,
            int timeout,
            String aaguids) {
        return new WebAuthnPolicyDTO(
                rpName,
                rpId,
                algorithms,
                attestation,
                attachment,
                residentKey,
                userVerification,
                timeout,
                true,
                aaguids);
    }

    private static LoginSettingsEntity settings() {
        LoginSettingsEntity value = new LoginSettingsEntity();
        value.setUserRegistrationEnabled(true);
        value.setForgotPasswordEnabled(true);
        value.setPasswordResetOtpMode("if-configured");
        value.setPasswordResetTokenLifespanSeconds(600);
        value.setPasswordResetResendCooldownSeconds(30);
        value.setRememberMeEnabled(true);
        value.setLoginWithEmail(true);
        value.setVerifyEmail(true);
        value.setEmailUpdateReauthenticationMinutes(5);
        value.setWebAuthnRpName("Sample");
        value.setWebAuthnRpId("");
        value.setWebAuthnSignatureAlgorithms("ES256,RS256");
        value.setWebAuthnAttestation("none");
        value.setWebAuthnAuthenticatorAttachment("any");
        value.setWebAuthnResidentKey("preferred");
        value.setWebAuthnUserVerification("preferred");
        value.setWebAuthnTimeoutSeconds(300);
        value.setWebAuthnAvoidSameAuthenticator(true);
        value.setWebAuthnAcceptableAaguids("");
        value.setWebAuthnPasswordlessRpName("Passwordless");
        value.setWebAuthnPasswordlessRpId("");
        value.setWebAuthnPasswordlessSignatureAlgorithms("ES256");
        value.setWebAuthnPasswordlessAttestation("none");
        value.setWebAuthnPasswordlessAuthenticatorAttachment("platform");
        value.setWebAuthnPasswordlessResidentKey("required");
        value.setWebAuthnPasswordlessUserVerification("required");
        value.setWebAuthnPasswordlessTimeoutSeconds(300);
        value.setWebAuthnPasswordlessAvoidSameAuthenticator(true);
        value.setWebAuthnPasswordlessAcceptableAaguids("");
        value.setGoogleLoginEnabled(true);
        value.setGithubLoginEnabled(false);
        value.setLinkedinLoginEnabled(true);
        value.setMicrosoftLoginEnabled(false);
        value.setSessionTimeoutMinutes(30);
        value.setPasswordMinimumLength(12);
        value.setPasswordMaximumLength(128);
        value.setPasswordMinimumUppercase(1);
        value.setPasswordMinimumLowercase(1);
        value.setPasswordMinimumDigits(1);
        value.setPasswordMinimumSpecialCharacters(1);
        value.setPasswordRejectUsername(true);
        value.setPasswordRejectEmail(true);
        value.setPasswordRejectCommonPasswords(true);
        value.setPasswordHistorySize(5);
        value.setPasswordExpirationDays(90);
        value.setPasswordCommonPasswords("password");
        value.setBruteForceEnabled(true);
        value.setBruteForceMaxFailures(5);
        value.setBruteForceMaxSecondaryFailures(2);
        value.setMfaVerificationTimeoutSeconds(300);
        value.setBruteForceQuickLoginWindowMillis(1000);
        value.setBruteForceMinimumQuickLoginWaitSeconds(60);
        value.setBruteForceWaitIncrementSeconds(60);
        value.setBruteForceMaxWaitSeconds(900);
        value.setBruteForceFailureResetTimeSeconds(43200);
        value.setBruteForceMaxTemporaryLockouts(3);
        value.setBruteForceIpRequestsPerMinute(30);
        value.setBruteForceUsernameIpRequestsPerMinute(5);
        value.setOtpEnabled(true);
        value.setOtpRequired(true);
        value.setOtpIssuer("Issuer");
        value.setOtpAlgorithm("SHA256");
        value.setOtpDigits(6);
        value.setOtpPeriodSeconds(30);
        value.setOtpLookAheadWindow(1);
        value.setOtpCodeReusable(true);
        value.setOtpAddRecoveryCodes(true);
        value.setRecoveryCodeWarningThreshold(2);
        return value;
    }
}
