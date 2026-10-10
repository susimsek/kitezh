package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationClaimEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationClaimRepository extends JpaRepository<OrganizationClaimEntity, Long> {

    List<OrganizationClaimEntity> findByOrganizationIdOrderByClaimNameAsc(Long organizationId);

    Optional<OrganizationClaimEntity> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByOrganizationIdAndClaimNameIgnoreCase(Long organizationId, String claimName);

    @Query(
            "select c from OrganizationClaimEntity c"
                    + " where c.organization.enabled = true"
                    + " and exists (select m.id from OrganizationMemberEntity m"
                    + " where m.organization.id = c.organization.id and m.user.id = :userId)"
                    + " order by c.claimName asc")
    List<OrganizationClaimEntity> findEnabledClaimsForUser(@Param("userId") Long userId);
}
