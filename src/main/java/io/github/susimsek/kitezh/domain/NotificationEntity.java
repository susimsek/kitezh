package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notifications")
public class NotificationEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(name = "audience", nullable = false, length = 16)
    private NotificationAudience audience;

    @Column(name = "recipient_user_id")
    private Long recipientUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 64)
    private NotificationType type;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
