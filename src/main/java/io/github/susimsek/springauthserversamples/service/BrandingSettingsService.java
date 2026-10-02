package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.BrandingSettingsEntity;
import io.github.susimsek.springauthserversamples.dto.account.BrandingSettingsDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminBrandingSettingsDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminBrandingSettingsRequestDTO;
import io.github.susimsek.springauthserversamples.repository.BrandingSettingsRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BrandingSettingsService {

    private static final long SETTINGS_ID = 1L;

    private final BrandingSettingsRepository repository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public BrandingSettingsDTO publicSettings() {
        return adminSettings().toPublic();
    }

    @Transactional(readOnly = true)
    public AdminBrandingSettingsDTO adminSettings() {
        return toAdminDTO(entity());
    }

    @Transactional
    @CacheEvict(
            cacheNames = BrandingSettingsRepository.BRANDING_SETTINGS_BY_ID_CACHE,
            allEntries = true)
    public AdminBrandingSettingsDTO update(AdminBrandingSettingsRequestDTO request) {
        BrandingSettingsEntity settings = entity();
        settings.setApplicationName(request.applicationName().trim());
        settings.setPrimaryColor(request.primaryColor().toLowerCase(java.util.Locale.ROOT));
        settings.setAccentColor(request.accentColor().toLowerCase(java.util.Locale.ROOT));
        settings.setBackgroundColor(request.backgroundColor().toLowerCase(java.util.Locale.ROOT));
        repository.save(settings);
        auditEventService.record("branding.settings.updated", "branding", "default");
        return toAdminDTO(settings);
    }

    private BrandingSettingsEntity entity() {
        return repository
                .findById(SETTINGS_ID)
                .orElseThrow(
                        () -> new IllegalStateException("Branding settings are not initialized"));
    }

    private static AdminBrandingSettingsDTO toAdminDTO(BrandingSettingsEntity settings) {
        return new AdminBrandingSettingsDTO(
                settings.getApplicationName(),
                settings.getLogoPath(),
                settings.getFaviconPath(),
                settings.getAppleTouchIconPath(),
                settings.getPrimaryColor(),
                settings.getAccentColor(),
                settings.getBackgroundColor());
    }
}
