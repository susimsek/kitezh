package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface SocialProviderRepository
        extends JpaRepository<SocialProviderEntity, String>,
                JpaSpecificationExecutor<SocialProviderEntity> {

    String SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE = "socialProvidersByRegistrationId";
    String SOCIAL_PROVIDER_BY_ALIAS_CACHE = "socialProvidersByAlias";

    @Cacheable(cacheNames = SOCIAL_PROVIDER_BY_REGISTRATION_ID_CACHE, key = "#registrationId")
    Optional<SocialProviderEntity> findByRegistrationId(String registrationId);

    @Cacheable(cacheNames = SOCIAL_PROVIDER_BY_ALIAS_CACHE, key = "#alias")
    Optional<SocialProviderEntity> findByAliasIgnoreCase(String alias);

    boolean existsByAliasIgnoreCase(String alias);

    boolean existsByRegistrationId(String registrationId);

    java.util.List<SocialProviderEntity>
            findAllByProviderTypeIgnoreCaseAndEnabledTrueOrderByGuiOrderAsc(String providerType);
}
