package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.UserProfileAttributeDefinitionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileAttributeDefinitionRepository
        extends JpaRepository<UserProfileAttributeDefinitionEntity, Long> {

    String ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE = "userProfileAttributeDefinitions";
    String ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE = "enabledUserProfileAttributeDefinitions";
    String PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE = "userProfileAttributeDefinitionsByName";

    @Cacheable(cacheNames = ALL_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE)
    List<UserProfileAttributeDefinitionEntity> findAllByOrderByDisplayOrderAscNameAsc();

    @Cacheable(cacheNames = ENABLED_PROFILE_ATTRIBUTE_DEFINITIONS_CACHE)
    List<UserProfileAttributeDefinitionEntity> findAllByEnabledTrueOrderByDisplayOrderAscNameAsc();

    Page<UserProfileAttributeDefinitionEntity>
            findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
                    String name, String displayName, Pageable pageable);

    @Cacheable(cacheNames = PROFILE_ATTRIBUTE_DEFINITION_BY_NAME_CACHE, key = "#name")
    Optional<UserProfileAttributeDefinitionEntity> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
