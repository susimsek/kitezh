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
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** Realm-wide settings for recording user authentication events. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "user_event_settings")
public class UserEventSettingsEntity {

    @Id private Long id;

    @Column(name = "events_enabled", nullable = false)
    private boolean eventsEnabled;

    @Column(name = "events_expiration_days", nullable = false)
    private int eventsExpirationDays;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    @CollectionTable(
            name = "user_event_settings_types",
            joinColumns = @JoinColumn(name = "settings_id"))
    @Column(name = "event_type", nullable = false, length = 50)
    private Set<UserEventType> eventTypes = new HashSet<>();
}
