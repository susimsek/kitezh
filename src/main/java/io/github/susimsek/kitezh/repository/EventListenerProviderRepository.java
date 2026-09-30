package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.EventListenerProviderEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventListenerProviderRepository
        extends JpaRepository<EventListenerProviderEntity, String> {

    boolean existsByNameIgnoreCase(String name);

    Optional<EventListenerProviderEntity> findByNameIgnoreCase(String name);
}
