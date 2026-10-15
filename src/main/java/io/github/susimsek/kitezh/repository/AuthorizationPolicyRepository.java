package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthorizationPolicyEntity;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorizationPolicyRepository
        extends JpaRepository<AuthorizationPolicyEntity, String> {

    Page<AuthorizationPolicyEntity> findByNameContainingIgnoreCase(String name, Pageable pageable);

    boolean existsByResourceServerClientIdAndNameIgnoreCase(
            String resourceServerClientId, String name);

    boolean existsByResourceServerClientIdAndNameIgnoreCaseAndIdNot(
            String resourceServerClientId, String name, String id);

    List<AuthorizationPolicyEntity> findAllByResourceServerClientId(String resourceServerClientId);
}
