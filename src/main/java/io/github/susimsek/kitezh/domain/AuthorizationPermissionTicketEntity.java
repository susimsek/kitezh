package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Short-lived UMA permission ticket; the database stores only its SHA-256 digest. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authz_permission_ticket")
public class AuthorizationPermissionTicketEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "resource_server_client_id", nullable = false, length = 100)
    private String resourceServerClientId;

    @Column(name = "resource_id", nullable = false, length = 36)
    private String resourceId;

    @Column(name = "requested_scopes", nullable = false, length = 1000)
    private String requestedScopes;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;
}
