package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.ClientMapperEntity;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientMapperRepository extends JpaRepository<ClientMapperEntity, Long> {

    @EntityGraph(attributePaths = "client")
    Page<ClientMapperEntity> findByClientIdAndNameContainingIgnoreCase(
            String clientId, String name, Pageable pageable);

    @EntityGraph(attributePaths = "client")
    List<ClientMapperEntity> findAllByClientIdOrderByPriorityAscNameAsc(String clientId);

    boolean existsByClientIdAndNameIgnoreCase(String clientId, String name);

    boolean existsByClientIdAndNameIgnoreCaseAndIdNot(String clientId, String name, Long id);
}
