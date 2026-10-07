package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationGroupMemberEntity;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationGroupMemberRepository
        extends JpaRepository<OrganizationGroupMemberEntity, Long> {

    @EntityGraph(attributePaths = "user")
    Page<OrganizationGroupMemberEntity> findByGroupIdAndUserUsernameContainingIgnoreCase(
            Long groupId, String username, Pageable pageable);

    Optional<OrganizationGroupMemberEntity> findByGroupIdAndUserId(Long groupId, Long userId);

    long countByGroupId(Long groupId);

    @Query(
            "select u from UserEntity u where"
                    + " (:query = '' or lower(u.username) like lower(concat('%', :query, '%'))"
                    + " or lower(coalesce(u.email, '')) like lower(concat('%', :query, '%')))"
                    + " and exists (select m.id from OrganizationMemberEntity m"
                    + " where m.organization.id = :organizationId and m.user.id = u.id)"
                    + " and not exists (select gm.id from OrganizationGroupMemberEntity gm"
                    + " where gm.group.id = :groupId and gm.user.id = u.id)")
    Page<io.github.susimsek.kitezh.domain.UserEntity> findAvailableUsers(
            @Param("organizationId") Long organizationId,
            @Param("groupId") Long groupId,
            @Param("query") String query,
            Pageable pageable);
}
