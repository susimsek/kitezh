package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationPermissionEntity;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuthorizationPermissionRepository
        extends JpaRepository<AuthorizationPermissionEntity, String> {

    List<AuthorizationPermissionEntity> findByResourceId(String resourceId);

    @EntityGraph(attributePaths = "policies")
    List<AuthorizationPermissionEntity> findWithPoliciesByResourceId(String resourceId);

    @EntityGraph(attributePaths = "policies")
    @Query("select distinct permission from AuthorizationPermissionEntity permission")
    Page<AuthorizationPermissionEntity> findAllWithPolicies(Pageable pageable);

    boolean existsByResourceIdAndNameIgnoreCase(String resourceId, String name);

    boolean existsByResourceIdAndNameIgnoreCaseAndIdNot(String resourceId, String name, String id);

    boolean existsByResourceIdAndScopeName(String resourceId, String scopeName);

    void deleteByResourceId(String resourceId);
}
