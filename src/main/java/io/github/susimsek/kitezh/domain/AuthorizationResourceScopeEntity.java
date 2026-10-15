package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A named operation that can be granted for a protected resource. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
        name = "authz_resource_scope",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_authz_resource_scope_name",
                        columnNames = {"resource_id", "name"}))
public class AuthorizationResourceScopeEntity extends AuditableEntity {

    @Id
    @Column(name = "id", nullable = false, length = 36)
    private String id;

    @Column(name = "resource_id", nullable = false, length = 36)
    private String resourceId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", length = 500)
    private String description;
}
