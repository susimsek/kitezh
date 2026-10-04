package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.RecoveryCodeEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesDTO;
import io.github.susimsek.kitezh.dto.account.RecoveryCodesStatusDTO;
import io.github.susimsek.kitezh.repository.LoginSettingsRepository;
import io.github.susimsek.kitezh.repository.RecoveryCodeRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.MfaBruteForceService;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RecoveryCodeService {

    private static final int CODE_COUNT = 12;
    private static final int CODE_GROUP_LENGTH = 4;
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final UserRepository userRepository;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditEventService auditEventService;
    private final MfaBruteForceService mfaBruteForceService;
    private final LoginSettingsRepository loginSettingsRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional(readOnly = true)
    public RecoveryCodesStatusDTO status(String username) {
        UserEntity user = findUser(username);
        int warningThreshold =
                loginSettingsRepository == null
                        ? 0
                        : loginSettingsRepository
                                .findById(1L)
                                .map(value -> value.getRecoveryCodeWarningThreshold())
                                .orElse(0);
        return new RecoveryCodesStatusDTO(
                user.isTotpEnabled()
                        ? Math.toIntExact(
                                recoveryCodeRepository.countByUserIdAndUsedAtIsNull(user.getId()))
                        : 0,
                warningThreshold);
    }

    @Transactional
    public RecoveryCodesDTO generate(String username) {
        UserEntity user = userForUpdate(username);
        if (!user.isTotpEnabled()) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST,
                    "Enable authenticator-based MFA before generating recovery codes");
        }
        recoveryCodeRepository.deleteByUserId(user.getId());
        List<String> plainCodes = new ArrayList<>(CODE_COUNT);
        List<RecoveryCodeEntity> entities = new ArrayList<>(CODE_COUNT);
        for (int index = 0; index < CODE_COUNT; index++) {
            String code = newCode();
            plainCodes.add(code);
            RecoveryCodeEntity entity = new RecoveryCodeEntity();
            entity.setUser(user);
            entity.setCodeIndex(index);
            entity.setCodeHash(passwordEncoder.encode(normalize(code)));
            entities.add(entity);
        }
        recoveryCodeRepository.saveAll(entities);
        auditEventService.record(
                "account.mfa.recovery-codes.generated", "user", user.getId().toString());
        return new RecoveryCodesDTO(plainCodes, CODE_COUNT);
    }

    @Transactional
    public boolean consume(String username, String code) {
        if (mfaBruteForceService != null && mfaBruteForceService.isLocked(username)) {
            return false;
        }
        UserEntity user = userForUpdate(username);
        if (user.isMfaPermanentlyLocked()) {
            return false;
        }
        String normalized = normalize(code);
        if (normalized.length() != CODE_COUNT) {
            if (mfaBruteForceService != null) {
                mfaBruteForceService.recordFailure(username);
            }
            return false;
        }
        RecoveryCodeEntity candidate =
                recoveryCodeRepository.findNextUnusedForUpdate(user.getId()).orElse(null);
        if (candidate != null && passwordEncoder.matches(normalized, candidate.getCodeHash())) {
            candidate.setUsedAt(Instant.now());
            recoveryCodeRepository.save(candidate);
            auditEventService.record(
                    "account.mfa.recovery-code.used", "user", user.getId().toString());
            if (mfaBruteForceService != null) {
                mfaBruteForceService.recordSuccess(username);
            }
            return true;
        }
        if (mfaBruteForceService != null) {
            mfaBruteForceService.recordFailure(username);
        }
        return false;
    }

    private UserEntity findUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private UserEntity userForUpdate(String username) {
        return userRepository
                .findForMfaUpdate(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private String newCode() {
        StringBuilder code = new StringBuilder(CODE_GROUP_LENGTH * 3 + 2);
        for (int group = 0; group < 3; group++) {
            if (group > 0) {
                code.append('-');
            }
            for (int index = 0; index < CODE_GROUP_LENGTH; index++) {
                code.append(ALPHABET.charAt(secureRandom.nextInt(ALPHABET.length())));
            }
        }
        return code.toString();
    }

    private static String normalize(String code) {
        return code == null ? "" : code.replaceAll("[-\\s]", "").toUpperCase(Locale.ROOT);
    }
}
