package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A protected resource registered by a resource server. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authz_resource")
public class AuthorizationResourceEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "resource_server_client_id", nullable = false, length = 100)
    private String resourceServerClientId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "resource_type", length = 200)
    private String type;

    @Column(name = "uri", length = 1000)
    private String uri;

    @Column(name = "owner_subject", nullable = false, length = 200)
    private String ownerSubject;

    @Column(name = "owner_managed_access", nullable = false)
    private boolean ownerManagedAccess;
}
