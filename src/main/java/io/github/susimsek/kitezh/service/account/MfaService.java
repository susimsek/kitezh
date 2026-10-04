package io.github.susimsek.kitezh.service.account;

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
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MfaService {

    private static final String INVALID_AUTHENTICATOR_CODE = "The authenticator code is invalid";

    private final UserRepository userRepository;
    private final LoginSettingsRepository loginSettingsRepository;
    private final TotpService totpService;
    private final AdminAuditEventService auditEventService;
    private final UserAccessInvalidationService userAccessInvalidationService;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final MfaBruteForceService mfaBruteForceService;

    @Transactional(readOnly = true)
    public MfaStatusDTO status(String username) {
        UserEntity user = user(username);
        LoginSettingsEntity settings = settings();
        return new MfaStatusDTO(
                user.isTotpEnabled(),
                settings.isOtpEnabled(),
                settings.isOtpRequired(),
                settings.getOtpIssuer(),
                settings.getOtpAlgorithm(),
                settings.getOtpDigits(),
                settings.getOtpPeriodSeconds());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public MfaSetupDTO setup(String username) {
        LoginSettingsEntity settings = settings();
        if (!settings.isOtpEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "TOTP enrollment is disabled");
        }
        UserEntity user = userForMfaUpdate(username);
        String secret = user.getTotpSecret();
        if (secret == null || user.isTotpEnabled()) {
            secret = totpService.newSecret();
            user.setTotpSecret(secret);
            user.setTotpEnabled(false);
            user.setTotpLastUsedCounter(null);
            userRepository.save(user);
        }
        return new MfaSetupDTO(
                secret,
                totpService.qrCodeDataUri(
                        totpService.otpauthUri(
                                settings.getOtpIssuer(),
                                user.getUsername(),
                                secret,
                                settings.getOtpAlgorithm(),
                                settings.getOtpDigits(),
                                settings.getOtpPeriodSeconds())),
                settings.getOtpAlgorithm(),
                settings.getOtpDigits(),
                settings.getOtpPeriodSeconds());
    }

    @Transactional(noRollbackFor = ApiException.class)
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void enable(String username, String code) {
        rejectIfMfaLocked(username);
        LoginSettingsEntity settings = settings();
        UserEntity user = userForMfaUpdate(username);
        if (user.isMfaPermanentlyLocked()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, INVALID_AUTHENTICATOR_CODE);
        }
        if (!settings.isOtpEnabled() || !consumeCode(user, settings, code)) {
            recordMfaFailure(username);
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, INVALID_AUTHENTICATOR_CODE);
        }
        user.setTotpEnabled(true);
        userRepository.save(user);
        recordMfaSuccess(username);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("account.mfa.enabled", "user", user.getId().toString());
    }

    @Transactional(noRollbackFor = ApiException.class)
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, allEntries = true)
    public void disable(String username, String code) {
        rejectIfMfaLocked(username);
        LoginSettingsEntity settings = settings();
        UserEntity user = userForMfaUpdate(username);
        if (user.isMfaPermanentlyLocked()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, INVALID_AUTHENTICATOR_CODE);
        }
        if (!consumeCode(user, settings, code)) {
            recordMfaFailure(username);
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, INVALID_AUTHENTICATOR_CODE);
        }
        user.setTotpSecret(null);
        user.setTotpEnabled(false);
        user.setTotpLastUsedCounter(null);
        user.setMfaFailedAttemptCount(0);
        user.setMfaPermanentlyLocked(false);
        if (recoveryCodeRepository != null) {
            recoveryCodeRepository.deleteByUserId(user.getId());
        }
        userRepository.save(user);
        recordMfaSuccess(username);
        userAccessInvalidationService.invalidate(user.getUsername());
        auditEventService.record("account.mfa.disabled", "user", user.getId().toString());
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, key = "#username")
    public boolean valid(String username, String code) {
        if (isMfaLocked(username)) {
            return false;
        }
        LoginSettingsEntity settings = settings();
        UserEntity user = userForMfaUpdate(username);
        if (user.isMfaPermanentlyLocked()) {
            return false;
        }
        boolean valid = user.isTotpEnabled() && consumeCode(user, settings, code);
        if (valid) {
            recordMfaSuccess(username);
        } else {
            recordMfaFailure(username);
        }
        return valid;
    }

    private void rejectIfMfaLocked(String username) {
        if (isMfaLocked(username)) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_TOTP_CODE, INVALID_AUTHENTICATOR_CODE);
        }
    }

    private boolean isMfaLocked(String username) {
        return mfaBruteForceService != null && mfaBruteForceService.isLocked(username);
    }

    private void recordMfaFailure(String username) {
        if (mfaBruteForceService != null) {
            mfaBruteForceService.recordFailure(username);
        }
    }

    private void recordMfaSuccess(String username) {
        if (mfaBruteForceService != null) {
            mfaBruteForceService.recordSuccess(username);
        }
    }

    private UserEntity user(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private UserEntity userForMfaUpdate(String username) {
        return userRepository
                .findForMfaUpdate(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private boolean consumeCode(UserEntity user, LoginSettingsEntity settings, String code) {
        if (user.getTotpSecret() == null) {
            return false;
        }
        var counter =
                totpService.matchingCounter(
                        user.getTotpSecret(),
                        code,
                        settings.getOtpAlgorithm(),
                        settings.getOtpDigits(),
                        settings.getOtpPeriodSeconds(),
                        settings.getOtpLookAheadWindow());
        if (counter.isEmpty()
                || (!settings.isOtpCodeReusable()
                        && counter.getAsLong()
                                == (user.getTotpLastUsedCounter() == null
                                        ? Long.MIN_VALUE
                                        : user.getTotpLastUsedCounter()))) {
            return false;
        }
        user.setTotpLastUsedCounter(counter.getAsLong());
        return true;
    }

    private LoginSettingsEntity settings() {
        return loginSettingsRepository
                .findById(1L)
                .orElseThrow(() -> new IllegalStateException("Login settings are not initialized"));
    }
}
