package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import java.util.Collection;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientScopeRepository extends JpaRepository<ClientScopeEntity, String> {

    String CLIENT_SCOPE_BY_NAME_CACHE = "clientScopesByName";

    @Cacheable(cacheNames = CLIENT_SCOPE_BY_NAME_CACHE, key = "#name")
    Optional<ClientScopeEntity> findByName(String name);

    boolean existsByName(String name);

    java.util.List<ClientScopeEntity> findByNameIn(Collection<String> names);

    Page<ClientScopeEntity> findByNameContainingIgnoreCaseOrDisplayNameContainingIgnoreCase(
            String name, String displayName, Pageable pageable);

    long countByNameIn(Collection<String> names);

    @EntityGraph(attributePaths = {"applicationRoles", "clientRoles"})
    @Query("select distinct s from ClientScopeEntity s where s.id = :id")
    Optional<ClientScopeEntity> findDetailedById(@Param("id") String id);

    @EntityGraph(attributePaths = {"applicationRoles", "clientRoles"})
    @Query("select distinct s from ClientScopeEntity s where s.name in :names")
    java.util.List<ClientScopeEntity> findDetailedByNameIn(
            @Param("names") Collection<String> names);
}
