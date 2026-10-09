package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Issued-token not-before policy scoped to this single-issuer application. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "authorization_revocation_policy")
public class AuthorizationRevocationPolicyEntity {

    @Id
    @Column(name = "id", nullable = false, length = 320)
    private String id;

    @Column(name = "scope_type", nullable = false, length = 20)
    private String scopeType;

    @Column(name = "scope_key", nullable = false, length = 200)
    private String scopeKey;

    @Column(name = "revoked_before", nullable = false)
    private Instant revokedBefore;

    public AuthorizationRevocationPolicyEntity(
            String id, String scopeType, String scopeKey, Instant revokedBefore) {
        this.id = id;
        this.scopeType = scopeType;
        this.scopeKey = scopeKey;
        this.revokedBefore = revokedBefore;
    }
}
