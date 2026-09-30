package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientScopeMapperRepository extends JpaRepository<ClientScopeMapperEntity, Long> {

    @EntityGraph(attributePaths = "clientScope")
    Page<ClientScopeMapperEntity> findByClientScopeIdAndNameContainingIgnoreCase(
            String clientScopeId, String name, Pageable pageable);

    @EntityGraph(attributePaths = "clientScope")
    List<ClientScopeMapperEntity> findAllByClientScopeIdInOrderByPriorityAscNameAsc(
            Collection<String> clientScopeIds);

    boolean existsByClientScopeIdAndNameIgnoreCase(String clientScopeId, String name);

    boolean existsByClientScopeIdAndNameIgnoreCaseAndIdNot(
            String clientScopeId, String name, Long id);
}
