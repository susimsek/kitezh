package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "admin_events")
public class AdminEventEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "actor", nullable = false, length = 100)
    private String actor;

    @Column(name = "client_id", length = 100)
    private String clientId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "action", nullable = false, length = 100)
    private String action;

    @Column(name = "target_type", nullable = false, length = 100)
    private String targetType;

    @Column(name = "target_id", nullable = false, length = 100)
    private String targetId;

    @Column(name = "details", length = 2000)
    private String details;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
