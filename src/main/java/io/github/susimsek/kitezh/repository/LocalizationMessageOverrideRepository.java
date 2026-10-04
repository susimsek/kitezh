package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.LocalizationMessageOverrideEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface LocalizationMessageOverrideRepository
        extends JpaRepository<LocalizationMessageOverrideEntity, Long>,
                JpaSpecificationExecutor<LocalizationMessageOverrideEntity> {

    String LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE = "localizationMessageOverridesByKey";

    @Cacheable(
            cacheNames = LOCALIZATION_MESSAGE_OVERRIDE_BY_KEY_CACHE,
            key = "#locale + ':' + #bundle + ':' + #messageKey")
    Optional<LocalizationMessageOverrideEntity> findByLocaleAndBundleAndMessageKey(
            String locale, String bundle, String messageKey);

    Page<LocalizationMessageOverrideEntity> findByLocaleAndBundle(
            String locale, String bundle, Pageable pageable);

    boolean existsByLocaleAndBundleAndMessageKey(String locale, String bundle, String messageKey);

    boolean existsByLocaleAndBundleAndMessageKeyAndIdNot(
            String locale, String bundle, String messageKey, Long id);
}
