package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationGroupEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationGroupRepository extends JpaRepository<OrganizationGroupEntity, Long> {

    @EntityGraph(attributePaths = "parent")
    Page<OrganizationGroupEntity> findByOrganizationIdAndNameContainingIgnoreCase(
            Long organizationId, String name, Pageable pageable);

    @EntityGraph(attributePaths = "parent")
    Optional<OrganizationGroupEntity> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByOrganizationIdAndNameIgnoreCase(Long organizationId, String name);

    boolean existsByOrganizationIdAndParentId(Long organizationId, Long parentId);

    long countByOrganizationId(Long organizationId);
}
