package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRoleRepository extends JpaRepository<ClientRoleEntity, Long> {

    @EntityGraph(attributePaths = {"client"})
    @Query(
            "select r from ClientRoleEntity r "
                    + "where r.client.id = :clientId "
                    + "and lower(r.name) like lower(concat('%', :name, '%'))")
    Page<ClientRoleEntity> findByClientIdAndNameContainingIgnoreCase(
            @Param("clientId") String clientId, @Param("name") String name, Pageable pageable);

    @EntityGraph(attributePaths = {"client"})
    @Query(
            "select r from ClientRoleEntity r where lower(r.name) like"
                    + " lower(concat('%', :query, '%')) or lower(r.client.clientId) like"
                    + " lower(concat('%', :query, '%'))")
    Page<ClientRoleEntity> findAllByNameOrClientIdContainingIgnoreCase(
            @Param("query") String query, Pageable pageable);

    @EntityGraph(
            attributePaths = {
                "client",
                "users",
                "groups",
                "compositeRoles",
                "compositeParents",
                "compositeRealmRoles"
            })
    @Query("select r from ClientRoleEntity r where r.id = :id")
    java.util.Optional<ClientRoleEntity> findDetailedById(@Param("id") Long id);

    @Query(
            "select r from ClientRoleEntity r where r.id <> :roleId and lower(r.name) like"
                    + " lower(concat('%', :query, '%')) and not exists (select child.id from"
                    + " ClientRoleEntity parent join parent.compositeRoles child where parent.id ="
                    + " :roleId and child.id = r.id)")
    Page<ClientRoleEntity> findAvailableCompositeRoles(
            @Param("roleId") Long roleId, @Param("query") String query, Pageable pageable);

    @Query(
            "select r from AuthorityEntity r where lower(r.name) like"
                    + " lower(concat('%', :query, '%')) and not exists (select child.id from"
                    + " ClientRoleEntity parent join parent.compositeRealmRoles child where"
                    + " parent.id = :roleId and child.id = r.id)")
    Page<AuthorityEntity> findAvailableRealmCompositeRoles(
            @Param("roleId") Long roleId, @Param("query") String query, Pageable pageable);

    @EntityGraph(attributePaths = {"client"})
    @Query(
            "select r from ClientRoleEntity r where (lower(r.name) like"
                    + " lower(concat('%', :query, '%')) or lower(r.client.clientId) like"
                    + " lower(concat('%', :query, '%'))) and not exists (select child.id from"
                    + " AuthorityEntity parent join parent.compositeClientRoles child where"
                    + " parent.name = :roleName and child.id = r.id)")
    Page<ClientRoleEntity> findAvailableClientRolesForAuthorityComposite(
            @Param("roleName") String roleName, @Param("query") String query, Pageable pageable);

    @Query(
            "select case when count(r) > 0 then true else false end "
                    + "from ClientRoleEntity r "
                    + "where r.client.id = :clientId and r.name = :name")
    boolean existsByClientIdAndName(@Param("clientId") String clientId, @Param("name") String name);

    @Query("select count(r) from ClientRoleEntity r where r.client.id = :clientId")
    long countByClientId(@Param("clientId") String clientId);

    long countByUsersId(Long userId);

    long countByGroupsId(Long groupId);
}
