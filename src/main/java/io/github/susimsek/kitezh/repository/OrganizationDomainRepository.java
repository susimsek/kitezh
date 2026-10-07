package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationDomainEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationDomainRepository
        extends JpaRepository<OrganizationDomainEntity, Long> {

    @EntityGraph(attributePaths = "organization")
    Page<OrganizationDomainEntity> findByOrganizationId(Long organizationId, Pageable pageable);

    boolean existsByDomainIgnoreCase(String domain);

    boolean existsByDomainIgnoreCaseAndIdNot(String domain, Long id);

    @EntityGraph(attributePaths = "organization")
    Optional<OrganizationDomainEntity> findById(Long id);

    Optional<OrganizationDomainEntity> findByVerificationTokenHash(String verificationTokenHash);
}
