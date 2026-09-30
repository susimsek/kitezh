package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthorityRepository extends JpaRepository<AuthorityEntity, Long> {

    String AUTHORITY_BY_NAME_CACHE = "authoritiesByName";

    List<AuthorityEntity> findByNameIn(Iterable<String> names);

    Page<AuthorityEntity> findByNameContainingIgnoreCase(String name, Pageable pageable);

    boolean existsByName(String name);

    @EntityGraph(attributePaths = {"compositeRoles", "compositeParents", "compositeClientRoles"})
    @Cacheable(cacheNames = AUTHORITY_BY_NAME_CACHE, key = "#name")
    Optional<AuthorityEntity> findByName(String name);

    @EntityGraph(attributePaths = {"compositeRoles", "compositeParents", "compositeClientRoles"})
    @Query("select distinct r from AuthorityEntity r")
    List<AuthorityEntity> findAllWithCompositeRoles();

    @Query(
            "select r from AuthorityEntity r where r.name <> :name and lower(r.name) like"
                    + " lower(concat('%', :query, '%')) and not exists (select child.id from"
                    + " AuthorityEntity parent join parent.compositeRoles child where parent.name ="
                    + " :name and child.id = r.id)")
    Page<AuthorityEntity> findAvailableCompositeRoles(
            @Param("name") String name, @Param("query") String query, Pageable pageable);
}
