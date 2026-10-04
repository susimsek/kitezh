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

/** Realm-wide policy applied to Client-Initiated Backchannel Authentication requests. */
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@Table(name = "ciba_policy")
public class CibaPolicyEntity {

    @Id private Long id;

    @Column(name = "request_lifespan_seconds", nullable = false)
    private int requestLifespanSeconds = 300;

    @Column(name = "polling_interval_seconds", nullable = false)
    private int pollingIntervalSeconds = 5;

    @Column(name = "delivery_mode", nullable = false, length = 10)
    private String deliveryMode = "all";

    @Column(name = "user_verification", nullable = false, length = 20)
    private String userVerification = "preferred";

    @Column(name = "mfa_required", nullable = false)
    private boolean mfaRequired;

    @Column(name = "step_up_required", nullable = false)
    private boolean stepUpRequired;

    @Column(name = "step_up_acr", length = 100)
    private String stepUpAcr;
}
