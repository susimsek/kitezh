package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.CibaPolicyEntity;
import java.util.Optional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CibaPolicyRepository extends JpaRepository<CibaPolicyEntity, Long> {

    String CIBA_POLICY_BY_ID_CACHE = "cibaPolicyById";

    @Override
    @Cacheable(cacheNames = CIBA_POLICY_BY_ID_CACHE, key = "#id")
    Optional<CibaPolicyEntity> findById(Long id);
}
