package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.EmailSettingsEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailSettingsRepository extends JpaRepository<EmailSettingsEntity, Long> {

    String EMAIL_SETTINGS_BY_ID_CACHE = "emailSettingsById";

    @Override
    @Cacheable(cacheNames = EMAIL_SETTINGS_BY_ID_CACHE, key = "#id")
    Optional<EmailSettingsEntity> findById(Long id);
}
