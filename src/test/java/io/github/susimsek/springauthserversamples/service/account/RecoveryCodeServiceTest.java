package io.github.susimsek.springauthserversamples.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.LoginSettingsEntity;
import io.github.susimsek.springauthserversamples.domain.RecoveryCodeEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.LoginSettingsRepository;
import io.github.susimsek.springauthserversamples.repository.RecoveryCodeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import io.github.susimsek.springauthserversamples.service.security.MfaBruteForceService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

@SuppressWarnings("java:S5778")
class RecoveryCodeServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final RecoveryCodeRepository recoveryCodeRepository =
            mock(RecoveryCodeRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AdminAuditEventService auditEventService = mock(AdminAuditEventService.class);
    private final MfaBruteForceService mfaBruteForceService = mock(MfaBruteForceService.class);
    private final LoginSettingsRepository loginSettingsRepository =
            mock(LoginSettingsRepository.class);

    @Test
    void generatesTwelveCodesAndReplacesExistingCodes() {
        UserEntity user = user();
        user.setTotpEnabled(true);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");

        var result = service().generate("alice");

        assertThat(result.codes())
                .hasSize(12)
                .allMatch(code -> code.matches("[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}"));
        assertThat(result.remaining()).isEqualTo(12);
        verify(recoveryCodeRepository).deleteByUserId(7L);
        verify(recoveryCodeRepository).saveAll(any());
    }

    @Test
    void consumesARecoveryCodeOnceAndNormalizesSeparators() {
        UserEntity user = user();
        user.setTotpEnabled(true);
        RecoveryCodeEntity candidate = new RecoveryCodeEntity();
        candidate.setUser(user);
        candidate.setCodeHash("encoded");
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(recoveryCodeRepository.findNextUnusedForUpdate(7L)).thenReturn(Optional.of(candidate));
        when(passwordEncoder.matches("ABCDEFGH IJKL".replace(" ", ""), "encoded")).thenReturn(true);

        assertThat(service().consume("alice", "ABCD-EFGH-IJKL")).isTrue();
        assertThat(candidate.getUsedAt()).isNotNull();
        verify(recoveryCodeRepository).save(candidate);
    }

    @Test
    void refusesGenerationUntilTotpIsEnabled() {
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user()));

        assertThatThrownBy(() -> service().generate("alice"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error ->
                                assertThat(error.getErrorCode())
                                        .isEqualTo(ApiErrorCode.INVALID_REQUEST));
    }

    @Test
    void reportsStatusAndWarningThresholdForTotpUsers() {
        UserEntity user = user();
        user.setTotpEnabled(true);
        var settings = new LoginSettingsEntity();
        settings.setRecoveryCodeWarningThreshold(4);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.of(settings));
        when(recoveryCodeRepository.countByUserIdAndUsedAtIsNull(7L)).thenReturn(9L);

        var result = serviceWithSettings().status("alice");

        assertThat(result.remaining()).isEqualTo(9);
        assertThat(result.warningThreshold()).isEqualTo(4);
    }

    @Test
    void reportsZeroRemainingCodesWhenTotpIsDisabledOrSettingsMissing() {
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user()));
        when(loginSettingsRepository.findById(1L)).thenReturn(Optional.empty());

        var result = serviceWithSettings().status("alice");

        assertThat(result.remaining()).isZero();
        assertThat(result.warningThreshold()).isZero();
    }

    @Test
    void rejectsMissingUsersForStatusAndGeneration() {
        when(userRepository.findByUsername("missing")).thenReturn(Optional.empty());
        when(userRepository.findForMfaUpdate("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().status("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
        assertThatThrownBy(() -> service().generate("missing"))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");
    }

    @Test
    void returnsFalseForLockedUsersAndPermanentlyLockedMfa() {
        UserEntity user = user();
        user.setMfaPermanentlyLocked(true);
        when(mfaBruteForceService.isLocked("alice")).thenReturn(true, false);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));

        assertThat(serviceWithMfa().consume("alice", "ABCD-EFGH-IJKL")).isFalse();
        assertThat(serviceWithMfa().consume("alice", "ABCD-EFGH-IJKL")).isFalse();

        verify(mfaBruteForceService, never()).recordFailure("alice");
    }

    @Test
    void recordsFailuresForInvalidCodesAndUnusedCodeMismatch() {
        UserEntity user = user();
        when(mfaBruteForceService.isLocked("alice")).thenReturn(false);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));

        assertThat(serviceWithMfa().consume("alice", "short")).isFalse();
        verify(mfaBruteForceService).recordFailure("alice");

        RecoveryCodeEntity candidate = new RecoveryCodeEntity();
        candidate.setCodeHash("encoded");
        when(recoveryCodeRepository.findNextUnusedForUpdate(7L)).thenReturn(Optional.of(candidate));
        when(passwordEncoder.matches("ABCDEFGHIJKL", "encoded")).thenReturn(false);

        assertThat(serviceWithMfa().consume("alice", "ABCD-EFGH-IJKL")).isFalse();
        verify(mfaBruteForceService, times(2)).recordFailure("alice");
    }

    @Test
    void recordsSuccessfulMfaRecoveryConsumption() {
        UserEntity user = user();
        RecoveryCodeEntity candidate = new RecoveryCodeEntity();
        candidate.setCodeHash("encoded");
        when(mfaBruteForceService.isLocked("alice")).thenReturn(false);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));
        when(recoveryCodeRepository.findNextUnusedForUpdate(7L)).thenReturn(Optional.of(candidate));
        when(passwordEncoder.matches("ABCDEFGHIJKL", "encoded")).thenReturn(true);

        assertThat(serviceWithMfa().consume("alice", "ABCD-EFGH-IJKL")).isTrue();

        assertThat(candidate.getUsedAt()).isNotNull();
        verify(mfaBruteForceService).recordSuccess("alice");
    }

    private RecoveryCodeService service() {
        return new RecoveryCodeService(
                userRepository,
                recoveryCodeRepository,
                passwordEncoder,
                auditEventService,
                null,
                loginSettingsRepository);
    }

    private RecoveryCodeService serviceWithMfa() {
        return new RecoveryCodeService(
                userRepository,
                recoveryCodeRepository,
                passwordEncoder,
                auditEventService,
                mfaBruteForceService,
                loginSettingsRepository);
    }

    private RecoveryCodeService serviceWithSettings() {
        return new RecoveryCodeService(
                userRepository,
                recoveryCodeRepository,
                passwordEncoder,
                auditEventService,
                null,
                loginSettingsRepository);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        return user;
    }
}
