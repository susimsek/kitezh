package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LocalizationSettingsEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LocalizationSettingsRepository
        extends JpaRepository<LocalizationSettingsEntity, Long> {

    String LOCALIZATION_SETTINGS_BY_ID_CACHE = "localizationSettingsById";

    @Override
    @Cacheable(cacheNames = LOCALIZATION_SETTINGS_BY_ID_CACHE, key = "#id")
    Optional<LocalizationSettingsEntity> findById(Long id);
}
