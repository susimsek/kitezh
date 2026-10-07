package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.UserEventEntity;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface UserEventRepository
        extends JpaRepository<UserEventEntity, String>, JpaSpecificationExecutor<UserEventEntity> {

    long deleteByOccurredAtBefore(Instant cutoff);
}
