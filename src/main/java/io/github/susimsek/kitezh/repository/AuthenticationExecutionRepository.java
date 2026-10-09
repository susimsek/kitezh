package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthenticationExecutionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthenticationExecutionRepository
        extends JpaRepository<AuthenticationExecutionEntity, Long> {

    List<AuthenticationExecutionEntity> findAllByFlowIdOrderByPriorityAscIdAsc(Long flowId);

    Optional<AuthenticationExecutionEntity> findByIdAndFlowId(Long id, Long flowId);

    boolean existsByFlowId(Long flowId);
}
