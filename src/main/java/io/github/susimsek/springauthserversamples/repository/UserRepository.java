package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    String USER_BY_USERNAME_CACHE = "usersByUsername";

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Cacheable(cacheNames = USER_BY_USERNAME_CACHE, key = "#username")
    Optional<UserEntity> findByUsername(String username);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Query("select u from UserEntity u where lower(u.username) = lower(:username)")
    Optional<UserEntity> findForAuthentication(@Param("username") String username);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Query(
            "select u from UserEntity u where lower(u.username) = lower(:identifier) or"
                    + " lower(u.email) = lower(:identifier)")
    Optional<UserEntity> findForAuthenticationByIdentifier(@Param("identifier") String identifier);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Query("select u from UserEntity u")
    List<UserEntity> findAllWithEffectiveAuthorities();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where lower(u.username) = lower(:username)")
    Optional<UserEntity> findForLoginUpdate(@Param("username") String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where lower(u.username) = lower(:username)")
    Optional<UserEntity> findForMfaUpdate(@Param("username") String username);

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    @Query("select u.id from UserEntity u where u.username = :username")
    Optional<Long> findIdByUsername(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where u.id = :id")
    Optional<UserEntity> findForActionById(Long id);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    Page<UserEntity> findByUsernameContainingIgnoreCase(String username, Pageable pageable);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    Page<UserEntity> findByUsernameContainingIgnoreCaseAndEnabled(
            String username, boolean enabled, Pageable pageable);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Query(
            "select u from UserEntity u where"
                    + " (:query = '' or lower(u.username) like lower(concat('%', :query, '%'))"
                    + " or lower(coalesce(u.firstName, '')) like lower(concat('%', :query, '%'))"
                    + " or lower(coalesce(u.lastName, '')) like lower(concat('%', :query, '%'))"
                    + " or lower(coalesce(u.email, '')) like lower(concat('%', :query, '%')) )"
                    + " and (:enabled is null or u.enabled = :enabled)")
    Page<UserEntity> searchUsers(
            @Param("query") String query, @Param("enabled") Boolean enabled, Pageable pageable);

    @EntityGraph(value = "User.withAuthorities")
    java.util.List<UserEntity> findAllByUsernameIn(java.util.Collection<String> usernames);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    List<UserEntity> findAllByIdIn(Collection<Long> ids);

    @EntityGraph(value = "User.withAuthorities")
    Page<UserEntity> findByAuthoritiesNameAndUsernameContainingIgnoreCase(
            String authorityName, String username, Pageable pageable);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    Page<UserEntity> findByClientRolesIdAndUsernameContainingIgnoreCase(
            Long clientRoleId, String username, Pageable pageable);

    @EntityGraph(value = "User.withEffectiveAuthorities")
    @Query(
            "select u from UserEntity u where"
                    + " (:query = '' or lower(u.username) like lower(concat('%', :query, '%')))"
                    + " and u.enabled = true"
                    + " and not exists (select r.id from u.clientRoles r where r.id = :roleId)")
    Page<UserEntity> findAvailableClientRoleUsers(
            @Param("roleId") Long roleId, @Param("query") String query, Pageable pageable);

    @EntityGraph(value = "User.withAuthorities")
    @Query(
            "select u from UserEntity u where"
                    + " (:query = '' or lower(u.username) like lower(concat('%', :query, '%')))"
                    + " and not exists (select a.id from u.authorities a where a.name = :roleName)")
    Page<UserEntity> findAvailableRoleUsers(
            @Param("roleName") String roleName, @Param("query") String query, Pageable pageable);

    long countByAuthoritiesName(String authorityName);

    long countByAuthoritiesId(Long authorityId);

    long countByClientRolesId(Long clientRoleId);

    long countByGroupsId(Long groupId);

    @Query(
            "select g.id as groupId, count(u.id) as userCount from UserEntity u join u.groups g"
                    + " where g.id in :groupIds group by g.id")
    List<GroupUserCount> countUsersByGroupIdIn(@Param("groupIds") Collection<Long> groupIds);

    @EntityGraph(value = "User.withAuthorities")
    Page<UserEntity> findByGroupsIdAndUsernameContainingIgnoreCase(
            Long groupId, String username, Pageable pageable);

    @EntityGraph(value = "User.withAuthorities")
    @Query(
            "select u from UserEntity u where"
                    + " (:query = '' or lower(u.username) like lower(concat('%', :query, '%')))"
                    + " and not exists (select g.id from u.groups g where g.id = :groupId)")
    Page<UserEntity> findAvailableGroupUsers(
            @Param("groupId") Long groupId, @Param("query") String query, Pageable pageable);

    @EntityGraph(value = "User.withAuthorities")
    java.util.List<UserEntity> findAllByGroupsId(Long groupId);

    interface GroupUserCount {
        Long getGroupId();

        long getUserCount();
    }
}
