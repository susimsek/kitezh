package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.localization.UserLocaleDTO;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserLocaleService {

    private final UserRepository userRepository;
    private final LocalizationSettingsService localizationSettingsService;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public UserLocaleDTO get(String username) {
        UserEntity user = requireUser(username);
        return new UserLocaleDTO(normalizeNullable(user.getPreferredLocale()));
    }

    @Transactional
    @CacheEvict(cacheNames = UserRepository.USER_BY_USERNAME_CACHE, key = "#username")
    public UserLocaleDTO update(String username, String locale) {
        String normalized = normalize(locale);
        if (!localizationSettingsService.isInternationalizationEnabled()
                || !localizationSettingsService.isSupported(Locale.forLanguageTag(normalized))) {
            throw ApiException.badRequest(
                    "locale", ApiErrorCode.INVALID_REQUEST, "The locale is not enabled.");
        }
        UserEntity user = requireUser(username);
        user.setPreferredLocale(normalized);
        userRepository.save(user);
        auditEventService.record("account.locale.updated", "user", user.getId().toString());
        return new UserLocaleDTO(normalized);
    }

    private UserEntity requireUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private static String normalize(String value) {
        String normalized =
                Locale.forLanguageTag(value == null ? "" : value.trim())
                        .getLanguage()
                        .toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw ApiException.badRequest(
                    "locale", ApiErrorCode.INVALID_REQUEST, "A valid locale is required.");
        }
        return normalized;
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : normalize(value);
    }
}
