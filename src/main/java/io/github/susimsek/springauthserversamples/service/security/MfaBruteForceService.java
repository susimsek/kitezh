package io.github.susimsek.springauthserversamples.service.security;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.LoginSettingsService;
import io.github.susimsek.springauthserversamples.service.admin.UserAccessInvalidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tracks failed secondary-authentication attempts independently from password failures. */
@Service
@RequiredArgsConstructor
public class MfaBruteForceService {

    private final UserRepository userRepository;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final LoginSettingsService loginSettingsService;

    @Transactional(readOnly = true)
    public boolean isLocked(String username) {
        return username != null
                && userRepository
                        .findByUsername(username.trim())
                        .map(UserEntity::isMfaPermanentlyLocked)
                        .orElse(false);
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void recordFailure(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        if (!loginSettingsService.isBruteForceEnabled()) {
            return;
        }
        int maximumFailures = loginSettingsService.bruteForceMaxSecondaryFailures();
        if (maximumFailures <= 0) {
            return;
        }
        userRepository
                .findForMfaUpdate(username.trim())
                .ifPresent(
                        user -> {
                            if (user.isMfaPermanentlyLocked()) {
                                return;
                            }
                            int failures = user.getMfaFailedAttemptCount() + 1;
                            user.setMfaFailedAttemptCount(failures);
                            if (failures >= maximumFailures) {
                                user.setMfaPermanentlyLocked(true);
                                userAccessInvalidationService.invalidate(user.getUsername());
                            }
                        });
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void recordSuccess(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        userRepository
                .findForMfaUpdate(username.trim())
                .ifPresent(
                        user -> {
                            if (!user.isMfaPermanentlyLocked()
                                    && user.getMfaFailedAttemptCount() > 0) {
                                user.setMfaFailedAttemptCount(0);
                            }
                        });
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void reset(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        userRepository
                .findForMfaUpdate(username.trim())
                .ifPresent(
                        user -> {
                            user.setMfaFailedAttemptCount(0);
                            user.setMfaPermanentlyLocked(false);
                        });
    }
}
