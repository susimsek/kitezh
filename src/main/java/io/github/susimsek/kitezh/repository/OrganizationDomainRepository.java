package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationDomainRepository
        extends JpaRepository<OrganizationDomainEntity, Long> {

    List<OrganizationDomainEntity> findByOrganizationIdOrderByDomainAsc(Long organizationId);

    Optional<OrganizationDomainEntity> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByDomainIgnoreCase(String domain);

    long countByOrganizationId(Long organizationId);
}
