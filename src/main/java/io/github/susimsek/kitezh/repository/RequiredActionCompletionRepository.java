package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.RequiredActionCompletionEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequiredActionCompletionRepository
        extends JpaRepository<RequiredActionCompletionEntity, Long> {

    Optional<RequiredActionCompletionEntity> findTopByUserIdAndActionKeyOrderByVersionDesc(
            Long userId, String actionKey);
}
