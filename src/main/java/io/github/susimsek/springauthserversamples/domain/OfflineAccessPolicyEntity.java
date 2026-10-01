package io.github.susimsek.springauthserversamples.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "offline_access_policy")
public class OfflineAccessPolicyEntity {

    @Id private Long id;

    @Column(name = "idle_timeout_seconds", nullable = false)
    private long idleTimeoutSeconds;

    @Column(name = "max_lifespan_seconds")
    private Long maxLifespanSeconds;

    @Column(name = "max_limited", nullable = false)
    private boolean maxLimited;

    @Column(name = "revoked_before")
    private Instant revokedBefore;
}
