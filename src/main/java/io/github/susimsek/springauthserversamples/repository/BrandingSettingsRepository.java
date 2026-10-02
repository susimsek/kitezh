package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.BrandingSettingsEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrandingSettingsRepository extends JpaRepository<BrandingSettingsEntity, Long> {

    String BRANDING_SETTINGS_BY_ID_CACHE = "brandingSettingsById";

    @Override
    @Cacheable(cacheNames = BRANDING_SETTINGS_BY_ID_CACHE, key = "#id")
    Optional<BrandingSettingsEntity> findById(Long id);
}
