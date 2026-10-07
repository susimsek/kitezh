package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationInvitationEntity;
import io.github.susimsek.kitezh.domain.OrganizationInvitationStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationInvitationRepository
        extends JpaRepository<OrganizationInvitationEntity, Long> {

    @EntityGraph(attributePaths = "organization")
    Page<OrganizationInvitationEntity> findByOrganizationId(Long organizationId, Pageable pageable);

    @EntityGraph(attributePaths = "organization")
    Optional<OrganizationInvitationEntity> findByTokenHash(String tokenHash);

    @EntityGraph(attributePaths = "organization")
    Optional<OrganizationInvitationEntity> findByOrganizationIdAndId(Long organizationId, Long id);

    boolean existsByOrganizationIdAndEmailIgnoreCaseAndStatus(
            Long organizationId, String email, OrganizationInvitationStatus status);
}
