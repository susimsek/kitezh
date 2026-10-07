package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationGroupEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationGroupRepository extends JpaRepository<OrganizationGroupEntity, Long> {

    @EntityGraph(attributePaths = {"organization", "roles"})
    @Query(
            "select g from OrganizationGroupEntity g where g.organization.id = :organizationId"
                    + " and (:query = '' or lower(g.name) like lower(concat('%', :query, '%')))"
                    + " order by g.name")
    Page<OrganizationGroupEntity> searchByOrganizationId(
            @Param("organizationId") Long organizationId,
            @Param("query") String query,
            Pageable pageable);

    @EntityGraph(attributePaths = {"organization", "roles"})
    Optional<OrganizationGroupEntity> findById(Long id);

    boolean existsByOrganizationIdAndNameIgnoreCase(Long organizationId, String name);

    boolean existsByOrganizationIdAndNameIgnoreCaseAndIdNot(
            Long organizationId, String name, Long id);
}
