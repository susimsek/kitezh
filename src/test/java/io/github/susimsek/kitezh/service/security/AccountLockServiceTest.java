package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AccountLockServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserAccessInvalidationService invalidationService;
    @Mock private ApplicationProperties applicationProperties;

    @Test
    void locksRapidFailuresAndUnlocksAfterTheWait() {
        ApplicationProperties.BruteForce policy =
                new ApplicationProperties.BruteForce(
                        true,
                        5,
                        Duration.ofMinutes(1),
                        Duration.ofMinutes(1),
                        Duration.ofMinutes(1),
                        Duration.ofMinutes(15),
                        Duration.ofHours(12),
                        3,
                        false,
                        30,
                        5);
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                new ApplicationProperties.PasswordPolicy(), policy));
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setEnabled(true);
        when(userRepository.findForLoginUpdate("alice")).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));

        final AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);
        service.recordFailure("alice", "127.0.0.1");
        service.recordFailure("alice", "127.0.0.1");

        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        assertThat(service.isLocked(user, Instant.now())).isTrue();

        user.setLockedUntil(Instant.now().minusSeconds(1));
        assertThat(service.isLocked(user, Instant.now())).isFalse();
        service.unlock(7L);

        assertThat(user.getFailedLoginCount()).isZero();
        assertThat(user.getLockedUntil()).isNull();
        verify(userRepository).findForActionById(7L);
    }

    @Test
    void ignoresFailuresWhenPolicyIsDisabledOrUsernameIsBlank() {
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                new ApplicationProperties.PasswordPolicy(),
                                policy(false, 5, 3, false)));

        final AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);
        service.recordFailure(null, "127.0.0.1");
        service.recordFailure(" ", "127.0.0.1");
        service.recordFailure("alice", "127.0.0.1");
        service.recordSuccess(null);
        service.recordSuccess(" ");

        verify(userRepository, never())
                .findForLoginUpdate(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void resetsFailuresAfterSuccessfulLogin() {
        UserEntity user = user(7L, "alice");
        user.setFailedLoginCount(4);
        user.setTemporaryLockoutCount(2);
        user.setPermanentlyLocked(true);
        user.setLastFailedLoginAt(Instant.now());
        user.setLockedUntil(Instant.now().plusSeconds(30));
        when(userRepository.findForLoginUpdate("alice")).thenReturn(Optional.of(user));

        final AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);
        service.recordSuccess(" alice ");

        assertThat(user.getFailedLoginCount()).isZero();
        assertThat(user.getTemporaryLockoutCount()).isZero();
        assertThat(user.isPermanentlyLocked()).isFalse();
        assertThat(user.getLastFailedLoginAt()).isNull();
        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void recognizesPermanentMfaAndTemporaryLocks() {
        Instant now = Instant.now();
        UserEntity user = user(1L, "alice");

        user.setPermanentlyLocked(true);
        assertThat(serviceWithPolicy().isLocked(user, now)).isTrue();
        user.setPermanentlyLocked(false);
        user.setMfaPermanentlyLocked(true);
        assertThat(serviceWithPolicy().isLocked(user, now)).isTrue();
        user.setMfaPermanentlyLocked(false);
        user.setLockedUntil(now.plusSeconds(10));
        assertThat(serviceWithPolicy().isLocked(user, now)).isTrue();
        user.setLockedUntil(now);
        assertThat(serviceWithPolicy().isLocked(user, now)).isFalse();
    }

    @Test
    void skipsDisabledPermanentAndCurrentlyLockedUsers() {
        ApplicationProperties.BruteForce policy = policy(true, 5, 3, false);
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                new ApplicationProperties.PasswordPolicy(), policy));
        final AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);

        UserEntity disabled = user(1L, "disabled");
        disabled.setEnabled(false);
        UserEntity permanent = user(2L, "permanent");
        permanent.setPermanentlyLocked(true);
        UserEntity locked = user(3L, "locked");
        locked.setLockedUntil(Instant.now().plusSeconds(30));
        when(userRepository.findForLoginUpdate("disabled")).thenReturn(Optional.of(disabled));
        when(userRepository.findForLoginUpdate("permanent")).thenReturn(Optional.of(permanent));
        when(userRepository.findForLoginUpdate("locked")).thenReturn(Optional.of(locked));

        service.recordFailure("disabled", "127.0.0.1");
        service.recordFailure("permanent", "127.0.0.1");
        service.recordFailure("locked", "127.0.0.1");

        assertThat(disabled.getFailedLoginCount()).isZero();
        assertThat(permanent.getFailedLoginCount()).isZero();
        assertThat(locked.getFailedLoginCount()).isZero();
    }

    @Test
    void resetsExpiredFailuresAndCapsTemporaryWait() {
        ApplicationProperties.BruteForce policy = policy(true, 1, 5, false);
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                new ApplicationProperties.PasswordPolicy(), policy));
        UserEntity user = user(7L, "alice");
        user.setLastFailedLoginAt(Instant.now().minus(Duration.ofHours(13)));
        user.setFailedLoginCount(4);
        when(userRepository.findForLoginUpdate("alice")).thenReturn(Optional.of(user));
        AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);

        service.recordFailure("alice", "127.0.0.1");
        assertThat(user.getFailedLoginCount()).isEqualTo(1);
        assertThat(user.getTemporaryLockoutCount()).isEqualTo(1);
        assertThat(user.getLockedUntil()).isAfter(Instant.now());

        user.setLockedUntil(Instant.now().minusSeconds(1));
        service.recordFailure("alice", "127.0.0.1");

        assertThat(user.getTemporaryLockoutCount()).isEqualTo(2);
        assertThat(user.getLockedUntil()).isBefore(Instant.now().plus(Duration.ofMinutes(6)));
    }

    @Test
    void permanentlyLocksAndInvalidatesAfterConfiguredLimit() {
        ApplicationProperties.BruteForce policy = policy(true, 1, 1, false);
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                new ApplicationProperties.PasswordPolicy(), policy));
        UserEntity user = user(7L, "alice");
        when(userRepository.findForLoginUpdate("alice")).thenReturn(Optional.of(user));
        AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);

        service.recordFailure("alice", "127.0.0.1");
        user.setLockedUntil(Instant.now().minusSeconds(1));
        service.recordFailure("alice", "127.0.0.1");

        assertThat(user.isPermanentlyLocked()).isTrue();
        assertThat(user.getLockedUntil()).isNull();
        verify(invalidationService).invalidate("alice");
    }

    @Test
    void unlockResetsMfaLockStateAndHandlesMissingUsers() {
        UserEntity user = user(7L, "alice");
        user.setMfaFailedAttemptCount(4);
        user.setMfaPermanentlyLocked(true);
        when(userRepository.findForActionById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findForActionById(99L)).thenReturn(Optional.empty());
        AccountLockService service =
                new AccountLockService(
                        userRepository, invalidationService, applicationProperties, null);

        service.unlock(7L);
        service.unlock(99L);

        assertThat(user.getMfaFailedAttemptCount()).isZero();
        assertThat(user.isMfaPermanentlyLocked()).isFalse();
    }

    private AccountLockService serviceWithPolicy() {
        return new AccountLockService(
                userRepository, invalidationService, applicationProperties, null);
    }

    private static ApplicationProperties.BruteForce policy(
            boolean enabled, int maxFailures, int maxTemporaryLockouts, boolean permanentLockout) {
        return new ApplicationProperties.BruteForce(
                enabled,
                maxFailures,
                Duration.ofMinutes(1),
                Duration.ofMinutes(1),
                Duration.ofMinutes(1),
                Duration.ofMinutes(5),
                Duration.ofHours(12),
                maxTemporaryLockouts,
                permanentLockout,
                30,
                5);
    }

    private static UserEntity user(Long id, String username) {
        UserEntity user = new UserEntity();
        user.setId(id);
        user.setUsername(username);
        user.setEnabled(true);
        return user;
    }
}
