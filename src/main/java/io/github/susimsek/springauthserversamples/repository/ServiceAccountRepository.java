package io.github.susimsek.springauthserversamples.repository;

import io.github.susimsek.springauthserversamples.domain.ServiceAccountEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceAccountRepository extends JpaRepository<ServiceAccountEntity, String> {

    @EntityGraph(attributePaths = "user")
    Optional<ServiceAccountEntity> findByClientId(String clientId);

    List<ServiceAccountEntity> findAllByClientIdIn(Collection<String> clientIds);

    boolean existsByUserId(Long userId);
}
