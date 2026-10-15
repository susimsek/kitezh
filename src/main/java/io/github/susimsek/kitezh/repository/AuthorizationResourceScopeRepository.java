package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationResourceScopeEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationResourceScopeRepository
        extends JpaRepository<AuthorizationResourceScopeEntity, String> {

    List<AuthorizationResourceScopeEntity> findByResourceId(String resourceId);

    List<AuthorizationResourceScopeEntity> findByResourceIdIn(List<String> resourceIds);

    Optional<AuthorizationResourceScopeEntity> findByResourceIdAndName(
            String resourceId, String name);

    boolean existsByResourceIdAndName(String resourceId, String name);

    void deleteByResourceIdAndNameNotIn(String resourceId, List<String> names);

    void deleteByResourceId(String resourceId);
}
