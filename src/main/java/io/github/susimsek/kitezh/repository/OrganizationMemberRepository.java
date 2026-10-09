package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationMemberEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationMemberRepository
        extends JpaRepository<OrganizationMemberEntity, Long> {

    @EntityGraph(attributePaths = "user")
    Page<OrganizationMemberEntity> findByOrganizationIdAndUserUsernameContainingIgnoreCase(
            Long organizationId, String username, Pageable pageable);

    Optional<OrganizationMemberEntity> findByOrganizationIdAndUserId(
            Long organizationId, Long userId);

    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);

    long countByOrganizationId(Long organizationId);

    @EntityGraph(attributePaths = "user")
    List<OrganizationMemberEntity> findByOrganizationId(Long organizationId);

    @Query(
            "select m.organization.id from OrganizationMemberEntity m"
                    + " where m.user.id = :userId")
    List<Long> findOrganizationIdsByUserId(@Param("userId") Long userId);

    @Query(
            "select m from OrganizationMemberEntity m join fetch m.organization"
                    + " where m.user.id = :userId")
    List<OrganizationMemberEntity> findWithOrganizationsByUserId(@Param("userId") Long userId);
}
