package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.MfaSetupDTO;
import io.github.susimsek.kitezh.dto.account.MfaStatusDTO;
import io.github.susimsek.kitezh.repository.LoginSettingsRepository;
import io.github.susimsek.kitezh.repository.RecoveryCodeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.MfaBruteForceService;
import io.github.susimsek.kitezh.service.security.TotpService;
import java.util.Optional;
import java.util.OptionalLong;
import org.junit.jupiter.api.Test;

@SuppressWarnings("java:S5778")
class MfaServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final LoginSettingsRepository loginSettingsRepository =
            mock(LoginSettingsRepository.class);
    private final TotpService totpService = mock(TotpService.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);
    private final MfaBruteForceService mfaBruteForceService = mock(MfaBruteForceService.class);
    private final RecoveryCodeRepository recoveryCodeRepository =
            mock(RecoveryCodeRepository.class);

    @Test
    void enablingMfaInvalidatesUserAccess() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpEnabled(true);
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));

        service().enable("alice", "123456");

        assertThat(user.isTotpEnabled()).isTrue();
        verify(invalidationService).invalidate("alice");
        verify(auditEventService).record("account.mfa.enabled", "user", "7");
    }

    @Test
    void setupReusesPendingSecret() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpEnabled(false);
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpEnabled(true);
        settings.setOtpIssuer("Issuer");
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        assertThat(service().setup("alice").secret()).isEqualTo("SECRET");
        verify(totpService, never()).newSecret();
    }

    @Test
    void invalidCodeDoesNotEnableMfaOrInvalidateAccess() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpEnabled(true);
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        assertThatThrownBy(() -> service().enable("alice", "000000"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error ->
                                assertThat(error.getErrorCode())
                                        .isEqualTo(ApiErrorCode.INVALID_TOTP_CODE));

        assertThat(user.isTotpEnabled()).isFalse();
        verify(userRepository, never()).save(user);
        verify(invalidationService, never()).invalidate("alice");
        verify(mfaBruteForceService).recordFailure("alice");
    }

    @Test
    void invalidCodeDoesNotDisableMfaOrInvalidateAccess() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpEnabled(true);
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        assertThatThrownBy(() -> service().disable("alice", "000000"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error ->
                                assertThat(error.getErrorCode())
                                        .isEqualTo(ApiErrorCode.INVALID_TOTP_CODE));

        assertThat(user.isTotpEnabled()).isTrue();
        assertThat(user.getTotpSecret()).isEqualTo("SECRET");
        verify(userRepository, never()).save(user);
        verify(invalidationService, never()).invalidate("alice");
    }

    @Test
    void validReturnsFalseWhenMfaIsNotEnabledForTheUser() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        assertThat(service().valid("alice", "123456")).isFalse();
        verify(totpService, never()).matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1);
    }

    @Test
    void rejectsTheSameCodeTwiceDuringOneTimeStep() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpEnabled(true);
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));

        assertThat(service().valid("alice", "123456")).isTrue();
        assertThat(service().valid("alice", "123456")).isFalse();
    }

    @Test
    void recordsInvalidMfaAttemptsForBruteForceProtection() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpEnabled(true);
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(totpService.matchingCounter("SECRET", "000000", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.empty());

        assertThat(service().valid("alice", "000000")).isFalse();

        verify(mfaBruteForceService).recordFailure("alice");
    }

    @Test
    void acceptsTheSameCodeTwiceWhenCodeReuseIsEnabled() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        user.setTotpSecret("SECRET");
        user.setTotpEnabled(true);
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        settings.setOtpCodeReusable(true);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(100L));

        assertThat(service().valid("alice", "123456")).isTrue();
        assertThat(service().valid("alice", "123456")).isTrue();
    }

    @Test
    void reportsMfaStatusFromUserAndLoginSettings() {
        UserEntity user = user(false, "SECRET");
        LoginSettingsEntity settings = settings(true);
        settings.setOtpRequired(true);
        settings.setOtpIssuer("Example");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));

        MfaStatusDTO status = service().status("alice");

        assertThat(status.enabled()).isFalse();
        assertThat(status.available()).isTrue();
        assertThat(status.required()).isTrue();
        assertThat(status.issuer()).isEqualTo("Example");
        assertThat(status.algorithm()).isEqualTo("SHA1");
        assertThat(status.digits()).isEqualTo(6);
        assertThat(status.periodSeconds()).isEqualTo(30);
    }

    @Test
    void setupGeneratesSecretAndBuildsQrCode() {
        UserEntity user = user(false, null);
        LoginSettingsEntity settings = settings(true);
        settings.setOtpIssuer("Example");
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(totpService.newSecret()).thenReturn("NEWSECRET");
        when(totpService.otpauthUri("Example", "alice", "NEWSECRET", "SHA1", 6, 30))
                .thenReturn("otpauth://totp/example");
        when(totpService.qrCodeDataUri("otpauth://totp/example")).thenReturn("data:image");

        MfaSetupDTO setup = service().setup("alice");

        assertThat(setup.secret()).isEqualTo("NEWSECRET");
        assertThat(setup.qrCode()).isEqualTo("data:image");
        assertThat(user.getTotpSecret()).isEqualTo("NEWSECRET");
        verify(userRepository).save(user);
    }

    @Test
    void setupRejectsDisabledEnrollmentAndReenrollsEnabledUser() {
        UserEntity user = user(true, "OLDSECRET");
        LoginSettingsEntity disabled = settings(false);
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(disabled));
        assertThatThrownBy(() -> service().setup("alice"))
                .isInstanceOf(ApiException.class)
                .hasMessage("TOTP enrollment is disabled");

        LoginSettingsEntity enabled = settings(true);
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(enabled));
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(totpService.newSecret()).thenReturn("NEWSECRET");
        when(totpService.otpauthUri("Issuer", "alice", "NEWSECRET", "SHA1", 6, 30))
                .thenReturn("uri");
        when(totpService.qrCodeDataUri("uri")).thenReturn("qr");

        assertThat(service().setup("alice").secret()).isEqualTo("NEWSECRET");
        assertThat(user.isTotpEnabled()).isFalse();
        assertThat(user.getTotpLastUsedCounter()).isNull();
    }

    @Test
    void enableRejectsLockedAndDisabledMfa() {
        UserEntity permanentlyLocked = user(false, "SECRET");
        permanentlyLocked.setMfaPermanentlyLocked(true);
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings(true)));
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(permanentlyLocked));
        assertThatThrownBy(() -> service().enable("alice", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The authenticator code is invalid");
        verify(totpService, never()).matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1);

        UserEntity user = user(false, "SECRET");
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings(false)));
        assertThatThrownBy(() -> service().enable("alice", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessage("The authenticator code is invalid");
        verify(mfaBruteForceService).recordFailure("alice");
    }

    @Test
    void disableClearsMfaAndRecoveryCodes() {
        UserEntity user = user(true, "SECRET");
        user.setMfaFailedAttemptCount(4);
        LoginSettingsEntity settings = settings(true);
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(totpService.matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1))
                .thenReturn(OptionalLong.of(20L));

        MfaService fullService =
                new MfaService(
                        userRepository,
                        loginSettingsRepository,
                        totpService,
                        auditEventService,
                        invalidationService,
                        recoveryCodeRepository,
                        mfaBruteForceService);
        fullService.disable("alice", "123456");

        assertThat(user.getTotpSecret()).isNull();
        assertThat(user.isTotpEnabled()).isFalse();
        assertThat(user.getMfaFailedAttemptCount()).isZero();
        assertThat(user.isMfaPermanentlyLocked()).isFalse();
        verify(recoveryCodeRepository).deleteByUserId(7L);
        verify(auditEventService).record("account.mfa.disabled", "user", "7");
    }

    @Test
    void validReturnsFalseWhenBruteForceOrPermanentLockApplies() {
        when(mfaBruteForceService.isLocked("alice")).thenReturn(true);
        assertThat(service().valid("alice", "123456")).isFalse();
        verify(userRepository, never()).findForMfaUpdate("alice");

        when(mfaBruteForceService.isLocked("alice")).thenReturn(false);
        UserEntity user = user(true, "SECRET");
        user.setMfaPermanentlyLocked(true);
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings(true)));
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        assertThat(service().valid("alice", "123456")).isFalse();
        verify(totpService, never()).matchingCounter("SECRET", "123456", "SHA1", 6, 30, 1);
    }

    @Test
    void reportsMissingUsersAndSettingsAndSupportsTheLegacyConstructor() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().status("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");

        UserEntity user = user(false, null);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().status("alice"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Login settings are not initialized");

        assertThat(
                        new MfaService(
                                userRepository,
                                loginSettingsRepository,
                                totpService,
                                auditEventService,
                                invalidationService,
                                recoveryCodeRepository,
                                mfaBruteForceService))
                .isNotNull();
    }

    private MfaService service() {
        return new MfaService(
                userRepository,
                loginSettingsRepository,
                totpService,
                auditEventService,
                invalidationService,
                null,
                mfaBruteForceService);
    }

    private static UserEntity user(boolean enabled, String secret) {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setTotpEnabled(enabled);
        user.setTotpSecret(secret);
        return user;
    }

    private static LoginSettingsEntity settings(boolean enabled) {
        LoginSettingsEntity settings = new LoginSettingsEntity();
        settings.setOtpEnabled(enabled);
        settings.setOtpIssuer("Issuer");
        settings.setOtpAlgorithm("SHA1");
        settings.setOtpDigits(6);
        settings.setOtpPeriodSeconds(30);
        settings.setOtpLookAheadWindow(1);
        return settings;
    }
}
