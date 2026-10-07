package io.github.susimsek.kitezh.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "event_listener_providers")
public class EventListenerProviderEntity {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 30)
    private EventListenerProviderType providerType;

    @Column(name = "endpoint_url", nullable = false, length = 1000)
    private String endpointUrl;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts;

    @Column(name = "backoff_seconds", nullable = false)
    private int backoffSeconds;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(
            name = "event_listener_provider_events",
            joinColumns = @JoinColumn(name = "provider_id"))
    @Column(name = "event_type", nullable = false, length = 30)
    private Set<EventListenerEventType> eventTypes = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
