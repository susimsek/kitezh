package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthenticationFlowRepository
        extends JpaRepository<AuthenticationFlowEntity, Long> {

    Page<AuthenticationFlowEntity> findByParentFlowIsNull(Pageable pageable);

    List<AuthenticationFlowEntity> findAllByParentFlowIdOrderByPriorityAscIdAsc(Long parentId);

    Optional<AuthenticationFlowEntity> findByAlias(String alias);

    boolean existsByAlias(String alias);

    boolean existsByParentFlowId(Long parentId);
}
