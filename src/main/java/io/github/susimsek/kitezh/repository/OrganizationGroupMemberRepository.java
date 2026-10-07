package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OrganizationGroupMemberEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationGroupMemberRepository
        extends JpaRepository<OrganizationGroupMemberEntity, Long> {

    @EntityGraph(attributePaths = {"user", "group", "group.organization"})
    @Query(
            "select m from OrganizationGroupMemberEntity m join m.user u"
                    + " where m.group.id = :groupId"
                    + " and (:query = '' or lower(u.username) like lower(concat('%', :query, '%'))"
                    + " or lower(coalesce(u.email, '')) like lower(concat('%', :query, '%')))"
                    + " order by u.username")
    Page<OrganizationGroupMemberEntity> searchByGroupId(
            @Param("groupId") Long groupId, @Param("query") String query, Pageable pageable);

    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    @EntityGraph(attributePaths = {"user", "group", "group.organization"})
    Optional<OrganizationGroupMemberEntity> findByGroupIdAndUserId(Long groupId, Long userId);

    @EntityGraph(attributePaths = {"group", "group.organization", "group.roles"})
    List<OrganizationGroupMemberEntity> findByUserId(Long userId);
}
