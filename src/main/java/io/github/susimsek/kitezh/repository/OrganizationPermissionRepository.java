package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationPermissionEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationPermissionRepository
        extends JpaRepository<OrganizationPermissionEntity, Long> {

    @EntityGraph(attributePaths = {"user", "organization"})
    Page<OrganizationPermissionEntity> findByOrganizationId(Long organizationId, Pageable pageable);

    Optional<OrganizationPermissionEntity> findByOrganizationIdAndUserId(
            Long organizationId, Long userId);

    boolean existsByOrganizationIdAndUserIdAndPermissionLevel(
            Long organizationId,
            Long userId,
            io.github.susimsek.kitezh.domain.OrganizationPermissionLevel
                    permissionLevel);
}
