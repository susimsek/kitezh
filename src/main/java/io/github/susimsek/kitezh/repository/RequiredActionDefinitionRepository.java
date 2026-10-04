package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequiredActionDefinitionRepository
        extends JpaRepository<RequiredActionDefinitionEntity, String> {

    String ENABLED_REQUIRED_ACTIONS_CACHE = "enabledRequiredActions";

    @Cacheable(cacheNames = ENABLED_REQUIRED_ACTIONS_CACHE)
    List<RequiredActionDefinitionEntity> findAllByEnabledTrueOrderByPriorityAscActionKeyAsc();
}
