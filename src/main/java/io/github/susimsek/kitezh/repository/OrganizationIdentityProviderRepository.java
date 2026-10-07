package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationIdentityProviderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationIdentityProviderRepository
        extends JpaRepository<OrganizationIdentityProviderEntity, Long> {

    @EntityGraph(attributePaths = "organization")
    Page<OrganizationIdentityProviderEntity> findByOrganizationId(
            Long organizationId, Pageable pageable);

    @EntityGraph(attributePaths = "organization")
    Optional<OrganizationIdentityProviderEntity> findById(Long id);

    boolean existsByOrganizationIdAndProviderAliasIgnoreCase(
            Long organizationId, String providerAlias);

    @EntityGraph(attributePaths = "organization")
    Optional<OrganizationIdentityProviderEntity> findByOrganizationIdAndProviderAliasIgnoreCase(
            Long organizationId, String providerAlias);

    @Query(
            "select p.providerAlias from OrganizationIdentityProviderEntity p"
                    + " where lower(p.organization.alias) = lower(:organizationAlias)"
                    + " and p.enabled = true order by p.providerAlias")
    List<String> findEnabledProviderAliasesByOrganizationAlias(
            @Param("organizationAlias") String organizationAlias);
}
