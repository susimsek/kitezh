package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.OfflineAccessPolicyEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfflineAccessPolicyRepository
        extends JpaRepository<OfflineAccessPolicyEntity, Long> {

    String OFFLINE_ACCESS_POLICY_BY_ID_CACHE = "offlineAccessPolicyById";

    @Override
    @Cacheable(cacheNames = OFFLINE_ACCESS_POLICY_BY_ID_CACHE, key = "#id")
    Optional<OfflineAccessPolicyEntity> findById(Long id);
}
