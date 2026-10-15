package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationResourceEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationResourceRepository
        extends JpaRepository<AuthorizationResourceEntity, String> {

    Page<AuthorizationResourceEntity> findByNameContainingIgnoreCase(
            String name, Pageable pageable);

    List<AuthorizationResourceEntity> findByResourceServerClientId(String resourceServerClientId);

    Page<AuthorizationResourceEntity> findAllByResourceServerClientId(
            String resourceServerClientId, Pageable pageable);

    Optional<AuthorizationResourceEntity> findByIdAndResourceServerClientId(
            String id, String resourceServerClientId);

    boolean existsByResourceServerClientIdAndNameIgnoreCase(
            String resourceServerClientId, String name);

    boolean existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
            String resourceServerClientId, String name, String id);
}
