package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientRepository extends JpaRepository<RegisteredClientEntity, String> {

    String REGISTERED_CLIENT_BY_CLIENT_ID_CACHE = "registeredClientsByClientId";

    @Cacheable(cacheNames = REGISTERED_CLIENT_BY_CLIENT_ID_CACHE, key = "#clientId")
    Optional<RegisteredClientEntity> findByClientId(String clientId);

    boolean existsByClientId(String clientId);

    Page<RegisteredClientEntity> findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
            String clientId, String clientName, Pageable pageable);
}
