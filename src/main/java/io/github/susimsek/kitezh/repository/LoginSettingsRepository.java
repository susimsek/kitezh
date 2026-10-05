package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LoginSettingsEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginSettingsRepository extends JpaRepository<LoginSettingsEntity, Long> {

    String LOGIN_SETTINGS_BY_ID_CACHE = "loginSettingsById";

    @Override
    @Cacheable(cacheNames = LOGIN_SETTINGS_BY_ID_CACHE, key = "#id")
    Optional<LoginSettingsEntity> findById(Long id);
}
