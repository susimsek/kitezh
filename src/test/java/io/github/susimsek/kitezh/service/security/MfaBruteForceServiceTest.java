package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MfaBruteForceServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserAccessInvalidationService invalidationService =
            mock(UserAccessInvalidationService.class);
    private final LoginSettingsService loginSettingsService = mock(LoginSettingsService.class);
    private final MfaBruteForceService service =
            new MfaBruteForceService(userRepository, invalidationService, loginSettingsService);

    @Test
    void permanentlyLocksAfterTheConfiguredNumberOfMfaFailures() {
        UserEntity user = user();
        when(loginSettingsService.isBruteForceEnabled()).thenReturn(true);
        when(loginSettingsService.bruteForceMaxSecondaryFailures()).thenReturn(2);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));

        service.recordFailure("alice");
        service.recordFailure("alice");

        assertThat(user.getMfaFailedAttemptCount()).isEqualTo(2);
        assertThat(user.isMfaPermanentlyLocked()).isTrue();
        verify(invalidationService).invalidate("alice");
    }

    @Test
    void successfulMfaResetsFailuresWhileTheAccountIsNotLocked() {
        UserEntity user = user();
        when(loginSettingsService.isBruteForceEnabled()).thenReturn(true);
        user.setMfaFailedAttemptCount(2);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));

        service.recordSuccess("alice");

        assertThat(user.getMfaFailedAttemptCount()).isZero();
        assertThat(user.isMfaPermanentlyLocked()).isFalse();
    }

    @Test
    void zeroDisablesSecondaryFailureLockout() {
        UserEntity user = user();
        when(loginSettingsService.isBruteForceEnabled()).thenReturn(true);
        when(loginSettingsService.bruteForceMaxSecondaryFailures()).thenReturn(0);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(user));

        service.recordFailure("alice");

        assertThat(user.getMfaFailedAttemptCount()).isZero();
        assertThat(user.isMfaPermanentlyLocked()).isFalse();
    }

    @Test
    void ignoresBlankDisabledMissingAndAlreadyLockedFailures() {
        when(loginSettingsService.isBruteForceEnabled()).thenReturn(false);
        service.recordFailure(" ");
        service.recordFailure("alice");
        verify(userRepository, never()).findForMfaUpdate("alice");

        UserEntity locked = user();
        locked.setMfaPermanentlyLocked(true);
        when(loginSettingsService.isBruteForceEnabled()).thenReturn(true);
        when(loginSettingsService.bruteForceMaxSecondaryFailures()).thenReturn(2);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(locked));
        service.recordFailure("alice");
        assertThat(locked.getMfaFailedAttemptCount()).isZero();
    }

    @Test
    void resetsOnlyExistingUnlockedMfaState() {
        UserEntity locked = user();
        locked.setMfaPermanentlyLocked(true);
        locked.setMfaFailedAttemptCount(4);
        when(userRepository.findForMfaUpdate("alice")).thenReturn(Optional.of(locked));

        service.recordSuccess("alice");
        service.reset("alice");

        assertThat(locked.getMfaFailedAttemptCount()).isZero();
        assertThat(locked.isMfaPermanentlyLocked()).isFalse();
        assertThat(service.isLocked(null)).isFalse();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(locked));
        assertThat(service.isLocked(" alice ")).isFalse();
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setUsername("alice");
        return user;
    }
}
