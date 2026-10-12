package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.NotificationReadReceiptEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationReadReceiptRepository
        extends JpaRepository<NotificationReadReceiptEntity, String> {

    Optional<NotificationReadReceiptEntity> findByNotificationIdAndUserId(
            String notificationId, Long userId);
}
