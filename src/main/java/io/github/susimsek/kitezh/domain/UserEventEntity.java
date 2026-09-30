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

/** Immutable record of a user authentication event. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_events")
public class UserEventEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "username", nullable = false, length = 100)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 50)
    private UserEventType type;

    @Column(name = "client_id", length = 100)
    private String clientId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
