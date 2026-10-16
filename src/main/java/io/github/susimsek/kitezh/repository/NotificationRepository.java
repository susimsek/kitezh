package io.github.susimsek.kitezh.repository;

import io.github.susimsek.kitezh.domain.NotificationAudience;
import io.github.susimsek.kitezh.domain.NotificationEntity;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<NotificationEntity, String> {

    Page<NotificationEntity> findByAudienceAndRecipientUserId(
            NotificationAudience audience, Long recipientUserId, Pageable pageable);

    Page<NotificationEntity> findByAudience(NotificationAudience audience, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from NotificationEntity n where n.id = :id")
    Optional<NotificationEntity> findByIdForUpdate(@Param("id") String id);

    @Query(
            "select count(n) from NotificationEntity n where n.audience = :audience and"
                    + " (n.recipientUserId = :recipientUserId or :recipientUserId is null) and"
                    + " not exists (select r.id from NotificationReadReceiptEntity r where"
                    + " r.notificationId = n.id and r.userId = :userId)")
    long countUnread(
            @Param("audience") NotificationAudience audience,
            @Param("recipientUserId") Long recipientUserId,
            @Param("userId") Long userId);

    @Query(
            "select r.notificationId from NotificationReadReceiptEntity r where r.userId = :userId"
                    + " and r.notificationId in :notificationIds")
    List<String> findReadNotificationIds(
            @Param("userId") Long userId,
            @Param("notificationIds") Collection<String> notificationIds);
}
