package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationInvitationEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationInvitationRepository
        extends JpaRepository<OrganizationInvitationEntity, Long> {

    @EntityGraph(attributePaths = "organization")
    Page<OrganizationInvitationEntity> findByOrganizationIdOrderByCreatedAtDesc(
            Long organizationId, Pageable pageable);

    Optional<OrganizationInvitationEntity> findByTokenHash(String tokenHash);
}
