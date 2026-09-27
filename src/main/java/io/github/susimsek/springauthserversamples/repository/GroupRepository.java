package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GroupRepository extends JpaRepository<GroupEntity, Long> {

    String DEFAULT_GROUPS_CACHE = "defaultGroups";

    @EntityGraph(attributePaths = {"authorities", "parent"})
    Page<GroupEntity> findByNameContainingIgnoreCase(String name, Pageable pageable);

    @EntityGraph(attributePaths = {"parent"})
    Page<GroupEntity> findByClientRolesIdAndNameContainingIgnoreCase(
            Long clientRoleId, String name, Pageable pageable);

    @EntityGraph(attributePaths = {"parent"})
    @Query(
            "select g from GroupEntity g where"
                    + " (:query = '' or lower(g.name) like lower(concat('%', :query, '%')))"
                    + " and not exists (select r.id from g.clientRoles r where r.id = :roleId)")
    Page<GroupEntity> findAvailableClientRoleGroups(
            @Param("roleId") Long roleId, @Param("query") String query, Pageable pageable);

    boolean existsByName(String name);

    boolean existsByParentId(Long parentId);

    @Cacheable(cacheNames = DEFAULT_GROUPS_CACHE)
    List<GroupEntity> findByDefaultGroupTrueOrderByNameAsc();

    @EntityGraph(attributePaths = "authorities")
    List<GroupEntity> findByParentId(Long parentId);

    @EntityGraph(attributePaths = {"authorities", "parent"})
    Optional<GroupEntity> findById(Long id);

    @EntityGraph(attributePaths = {"authorities", "parent"})
    @Query(
            value =
                    "select g from GroupEntity g where g.id in (select memberGroup.id from"
                        + " UserEntity u join u.groups memberGroup where u.id = :userId) and"
                        + " (:query = '' or lower(g.name) like lower(concat('%', :query, '%')))",
            countQuery =
                    "select count(g) from GroupEntity g where g.id in (select memberGroup.id from"
                        + " UserEntity u join u.groups memberGroup where u.id = :userId) and"
                        + " (:query = '' or lower(g.name) like lower(concat('%', :query, '%')))")
    Page<GroupEntity> findByUserIdAndNameContainingIgnoreCase(
            @Param("userId") Long userId, @Param("query") String query, Pageable pageable);
}
