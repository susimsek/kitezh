package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthenticationFlowBindingRepository
        extends JpaRepository<AuthenticationFlowBindingEntity, AuthenticationFlowBindingType> {

    List<AuthenticationFlowBindingEntity> findAllByOrderByBindingTypeAsc();

    boolean existsByFlowId(Long flowId);
}
