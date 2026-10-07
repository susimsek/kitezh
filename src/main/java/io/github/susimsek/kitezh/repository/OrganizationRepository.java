package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<OrganizationEntity, Long> {

    String ORGANIZATION_BY_ALIAS_CACHE = "organizationByAlias";

    @EntityGraph(attributePaths = "attributes")
    Page<OrganizationEntity> findByAliasContainingIgnoreCaseOrNameContainingIgnoreCase(
            String alias, String name, Pageable pageable);

    @EntityGraph(attributePaths = "attributes")
    Optional<OrganizationEntity> findById(Long id);

    @EntityGraph(attributePaths = "attributes")
    @Cacheable(cacheNames = ORGANIZATION_BY_ALIAS_CACHE, key = "#alias.toLowerCase()")
    Optional<OrganizationEntity> findByAliasIgnoreCase(String alias);

    boolean existsByAliasIgnoreCase(String alias);

    boolean existsByAliasIgnoreCaseAndIdNot(String alias, Long id);
}
