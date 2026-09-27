package io.github.susimsek.springauthserversamples.repository;

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

    @EntityGraph(attributePaths = {"client", "users", "groups"})
    @Query("select r from ClientRoleEntity r where r.id = :id")
    java.util.Optional<ClientRoleEntity> findDetailedById(@Param("id") Long id);

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
