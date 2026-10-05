package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.config.web.LocaleConfig;
import io.github.susimsek.kitezh.domain.LocalizationMessageOverrideEntity;
import io.github.susimsek.kitezh.domain.LocalizationSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideRequestDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsRequestDTO;
import io.github.susimsek.kitezh.repository.LocalizationMessageOverrideRepository;
import io.github.susimsek.kitezh.repository.LocalizationSettingsRepository;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LocalizationSettingsService {

    private static final long SETTINGS_ID = 1L;
    private static final String LOCALIZATION_MESSAGE_TARGET = "localization-message";
    private static final List<String> AVAILABLE_LOCALES = List.of("en", "tr");
    private static final List<String> AVAILABLE_BUNDLES =
            List.of("login", "account", "admin", "email", "backend", "common");
    private static final ResourceBundle.Control NO_FALLBACK_CONTROL =
            ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES);

    private final LocalizationSettingsRepository settingsRepository;
    private final LocalizationMessageOverrideRepository overrideRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public LocalizationSettingsDTO get() {
        LocalizationSettingsEntity settings = entity();
        return toDTO(settings);
    }

    @Transactional(readOnly = true)
    public List<String> availableLocales() {
        return AVAILABLE_LOCALES;
    }

    @Transactional(readOnly = true)
    public List<String> availableBundles() {
        return AVAILABLE_BUNDLES;
    }

    @Transactional(readOnly = true)
    public boolean isInternationalizationEnabled() {
        return entity().isInternationalizationEnabled();
    }

    @Transactional(readOnly = true)
    public List<String> supportedLocales() {
        return supportedLocalesInternal();
    }

    private List<String> supportedLocalesInternal() {
        return parseLocales(entity().getSupportedLocales());
    }

    @Transactional(readOnly = true)
    public Locale defaultLocale(Locale fallback) {
        String configured = entity().getDefaultLocale();
        return configured == null || configured.isBlank()
                ? fallback
                : Locale.forLanguageTag(configured);
    }

    @Transactional(readOnly = true)
    public boolean isSupported(Locale locale) {
        return locale != null
                && supportedLocalesInternal()
                        .contains(LocaleConfig.normalize(locale).getLanguage());
    }

    @Transactional
    @CacheEvict(
            cacheNames = LocalizationSettingsRepository.LOCALIZATION_SETTINGS_BY_ID_CACHE,
            allEntries = true)
    public LocalizationSettingsDTO update(LocalizationSettingsRequestDTO request) {
        List<String> locales = normalizeLocales(request.supportedLocales());
        String defaultLocale = normalizeLocale(request.defaultLocale());
        if (!locales.contains(defaultLocale)) {
            throw ApiException.badRequest(
                    "defaultLocale",
                    ApiErrorCode.INVALID_REQUEST,
                    "The default locale must be enabled.");
        }
        LocalizationSettingsEntity settings = entity();
        settings.setInternationalizationEnabled(request.internationalizationEnabled());
        settings.setDefaultLocale(defaultLocale);
        settings.setSupportedLocales(String.join(",", locales));
        settingsRepository.save(settings);
        auditEventService.record("localization.settings.updated", "localization", "default");
        return toDTO(settings);
    }

    @Transactional(readOnly = true)
    public Page<LocalizationMessageOverrideDTO> overrides(
            String query, String locale, String bundle, Pageable pageable) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (normalizedQuery.length() > 100) {
            throw ApiException.badRequest(
                    "q",
                    ApiErrorCode.SEARCH_TOO_LONG,
                    "Search query must not exceed 100 characters");
        }
        String normalizedLocale = locale == null || locale.isBlank() ? "" : normalizeLocale(locale);
        String normalizedBundle = bundle == null || bundle.isBlank() ? "" : validateBundle(bundle);
        Specification<LocalizationMessageOverrideEntity> specification =
                (root, ignored, cb) -> {
                    var predicate = cb.conjunction();
                    if (!normalizedQuery.isBlank()) {
                        String like = "%" + normalizedQuery + "%";
                        predicate =
                                cb.and(
                                        predicate,
                                        cb.or(
                                                cb.like(cb.lower(root.get("messageKey")), like),
                                                cb.like(cb.lower(root.get("messageValue")), like)));
                    }
                    if (!normalizedLocale.isBlank()) {
                        predicate =
                                cb.and(predicate, cb.equal(root.get("locale"), normalizedLocale));
                    }
                    if (!normalizedBundle.isBlank()) {
                        predicate =
                                cb.and(predicate, cb.equal(root.get("bundle"), normalizedBundle));
                    }
                    return predicate;
                };
        return overrideRepository
                .findAll(specification, pageable)
                .map(LocalizationSettingsService::toDTO);
    }

    @Transactional(readOnly = true)
    public Map<String, String> publicOverrides(String locale, String bundle) {
        String normalized = normalizeLocale(locale);
        String normalizedBundle = validatePublicBundle(bundle);
        if (!AVAILABLE_LOCALES.contains(normalized)) {
            return Map.of();
        }
        return overrideRepository
                .findByLocaleAndBundle(
                        normalized,
                        normalizedBundle,
                        PageRequest.of(0, 1000, Sort.by(Sort.Direction.ASC, "messageKey")))
                .stream()
                .collect(
                        Collectors.toMap(
                                LocalizationMessageOverrideEntity::getMessageKey,
                                LocalizationMessageOverrideEntity::getMessageValue,
                                (first, ignored) -> first,
                                LinkedHashMap::new));
    }

    @Transactional(readOnly = true)
    public Map<String, String> bundledMessages(String locale, String bundle) {
        String normalizedLocale = normalizeLocale(locale);
        String normalizedBundle = validatePublicBundle(bundle);
        if (!AVAILABLE_LOCALES.contains(normalizedLocale)) {
            return Map.of();
        }
        ResourceBundle resourceBundle =
                ResourceBundle.getBundle(
                        "i18n.messages",
                        Locale.forLanguageTag(normalizedLocale),
                        NO_FALLBACK_CONTROL);
        return resourceBundle.keySet().stream()
                .filter(key -> belongsToBundle(key, normalizedBundle))
                .sorted()
                .collect(
                        Collectors.toMap(
                                key -> key,
                                resourceBundle::getString,
                                (first, ignored) -> first,
                                LinkedHashMap::new));
    }

    @Transactional
    @CacheEvict(
            cacheNames =
                    LocalizationMessageOverrideRepository
                            .LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE,
            allEntries = true)
    public LocalizationMessageOverrideDTO create(LocalizationMessageOverrideRequestDTO request) {
        String locale = validateLocale(request.locale());
        String bundle = validateBundle(request.bundle());
        String key = request.messageKey().trim();
        if (overrideRepository.existsByLocaleAndBundleAndMessageKey(locale, bundle, key)) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT,
                    "A message override already exists for this locale and key.");
        }
        LocalizationMessageOverrideEntity entity = new LocalizationMessageOverrideEntity();
        apply(entity, locale, bundle, key, request.messageValue());
        LocalizationMessageOverrideEntity saved = overrideRepository.save(entity);
        auditEventService.record(
                "localization.message.override.created",
                LOCALIZATION_MESSAGE_TARGET,
                saved.getId().toString());
        return toDTO(saved);
    }

    @Transactional
    @CacheEvict(
            cacheNames =
                    LocalizationMessageOverrideRepository
                            .LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE,
            allEntries = true)
    public LocalizationMessageOverrideDTO updateMessageOverride(
            Long id, LocalizationMessageOverrideRequestDTO request) {
        LocalizationMessageOverrideEntity entity =
                overrideRepository
                        .findById(id)
                        .orElseThrow(() -> ApiException.notFound("Message override not found"));
        String locale = validateLocale(request.locale());
        String bundle = validateBundle(request.bundle());
        String key = request.messageKey().trim();
        if (overrideRepository.existsByLocaleAndBundleAndMessageKeyAndIdNot(
                locale, bundle, key, id)) {
            throw ApiException.conflict(
                    ApiErrorCode.CONFLICT,
                    "A message override already exists for this locale and key.");
        }
        apply(entity, locale, bundle, key, request.messageValue());
        overrideRepository.save(entity);
        auditEventService.record(
                "localization.message.override.updated",
                LOCALIZATION_MESSAGE_TARGET,
                id.toString());
        return toDTO(entity);
    }

    @Transactional
    @CacheEvict(
            cacheNames =
                    LocalizationMessageOverrideRepository
                            .LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE,
            allEntries = true)
    public void delete(Long id) {
        LocalizationMessageOverrideEntity entity =
                overrideRepository
                        .findById(id)
                        .orElseThrow(() -> ApiException.notFound("Message override not found"));
        overrideRepository.delete(entity);
        auditEventService.record(
                "localization.message.override.deleted",
                LOCALIZATION_MESSAGE_TARGET,
                id.toString());
    }

    private String validateLocale(String locale) {
        String normalized = normalizeLocale(locale);
        if (!AVAILABLE_LOCALES.contains(normalized)
                || !supportedLocalesInternal().contains(normalized)) {
            throw ApiException.badRequest(
                    "locale", ApiErrorCode.INVALID_REQUEST, "The locale is not enabled.");
        }
        return normalized;
    }

    private static String validateBundle(String bundle) {
        String normalized = bundle == null ? "" : bundle.trim().toLowerCase(Locale.ROOT);
        if (!AVAILABLE_BUNDLES.contains(normalized)) {
            throw ApiException.badRequest(
                    "bundle", ApiErrorCode.INVALID_REQUEST, "The message bundle is not supported.");
        }
        return normalized;
    }

    private static String validatePublicBundle(String bundle) {
        String normalized = bundle == null || bundle.isBlank() ? "admin" : bundle;
        return validateBundle(normalized);
    }

    private static boolean belongsToBundle(String key, String bundle) {
        if ("email".equals(bundle)) {
            return key.startsWith("mail.");
        }
        if ("backend".equals(bundle)) {
            return !key.startsWith("mail.");
        }
        return false;
    }

    private LocalizationSettingsEntity entity() {
        return settingsRepository
                .findById(SETTINGS_ID)
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Localization settings are not initialized"));
    }

    private static List<String> normalizeLocales(List<String> locales) {
        Set<String> normalized =
                locales.stream()
                        .map(LocalizationSettingsService::normalizeLocale)
                        .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        if (normalized.isEmpty() || !AVAILABLE_LOCALES.containsAll(normalized)) {
            throw ApiException.badRequest(
                    "supportedLocales",
                    ApiErrorCode.INVALID_REQUEST,
                    "Only locales available in this build can be enabled.");
        }
        return normalized.stream().toList();
    }

    private static String normalizeLocale(String locale) {
        return Locale.forLanguageTag(locale == null ? "" : locale.trim())
                .getLanguage()
                .toLowerCase(Locale.ROOT);
    }

    private static List<String> parseLocales(String value) {
        return Arrays.stream(value.split(","))
                .map(LocalizationSettingsService::normalizeLocale)
                .filter(s -> !s.isBlank())
                .toList();
    }

    private static void apply(
            LocalizationMessageOverrideEntity entity,
            String locale,
            String bundle,
            String key,
            String value) {
        entity.setLocale(locale);
        entity.setBundle(bundle);
        entity.setMessageKey(key);
        entity.setMessageValue(value.trim());
    }

    private static LocalizationSettingsDTO toDTO(LocalizationSettingsEntity entity) {
        return new LocalizationSettingsDTO(
                entity.isInternationalizationEnabled(),
                entity.getDefaultLocale(),
                parseLocales(entity.getSupportedLocales()),
                AVAILABLE_LOCALES,
                AVAILABLE_BUNDLES);
    }

    private static LocalizationMessageOverrideDTO toDTO(LocalizationMessageOverrideEntity entity) {
        return new LocalizationMessageOverrideDTO(
                entity.getId(),
                entity.getLocale(),
                entity.getBundle(),
                entity.getMessageKey(),
                entity.getMessageValue());
    }
}
