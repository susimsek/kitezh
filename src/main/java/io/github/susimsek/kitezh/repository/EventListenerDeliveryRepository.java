package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.EventListenerDeliveryEntity;
import io.github.susimsek.kitezh.domain.EventListenerDeliveryStatus;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventListenerDeliveryRepository
        extends JpaRepository<EventListenerDeliveryEntity, String> {

    Page<EventListenerDeliveryEntity> findByProviderId(String providerId, Pageable pageable);

    java.util.List<EventListenerDeliveryEntity>
            findTop100ByStatusAndNextAttemptAtLessThanEqualOrderByNextAttemptAtAsc(
                    EventListenerDeliveryStatus status, Instant now);
}
