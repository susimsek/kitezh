package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationIdentityProviderEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationIdentityProviderRepository
        extends JpaRepository<OrganizationIdentityProviderEntity, Long> {

    List<OrganizationIdentityProviderEntity> findByOrganizationIdOrderByProviderAliasAsc(
            Long organizationId);

    Optional<OrganizationIdentityProviderEntity> findByOrganizationIdAndProviderAliasIgnoreCase(
            Long organizationId, String providerAlias);
}
