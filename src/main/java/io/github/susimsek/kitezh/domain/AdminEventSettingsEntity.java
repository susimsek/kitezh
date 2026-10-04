package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

/** Realm-wide settings for the administrative audit event store. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "event_settings")
public class AdminEventSettingsEntity {

    @Id private Long id;

    @Column(name = "events_enabled", nullable = false)
    private boolean eventsEnabled;

    @Column(name = "admin_events_enabled", nullable = false)
    private boolean adminEventsEnabled;

    @Column(name = "admin_events_details_enabled", nullable = false)
    private boolean adminEventsDetailsEnabled;

    @Column(name = "events_expiration_days", nullable = false)
    private int eventsExpirationDays;
}
